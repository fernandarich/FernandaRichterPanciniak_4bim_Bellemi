const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const sharp = require('sharp');
const pool = require('../../db');

const PASTA_IMAGENS = path.resolve(__dirname, '../../../../Frontend/img');
const CAMPOS_PRODUTO = `
    p.id_produto AS id,
    p.nome_prod AS nome,
    p.descricao_prod AS descricao,
    p.preco,
    p.quant_estoque AS estoque,
    p.id_categoria AS categoria_id,
    c.nome_categoria AS categoria,
    p.imagem
`;

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function validarId(id) {
    return /^\d+$/.test(String(id)) &&
        Number.isSafeInteger(Number(id)) &&
        Number(id) > 0 &&
        Number(id) <= 2147483647;
}

function validarDados(body) {
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
    const preco = typeof body.preco === 'number'
        ? body.preco
        : typeof body.preco === 'string' && /^\d+(?:\.\d{1,2})?$/.test(body.preco.trim())
            ? Number(body.preco)
            : NaN;
    const estoque = typeof body.estoque === 'number'
        ? body.estoque
        : typeof body.estoque === 'string' && /^\d+$/.test(body.estoque.trim())
            ? Number(body.estoque)
            : NaN;
    const categoriaId = typeof body.categoriaId === 'number'
        ? body.categoriaId
        : typeof body.categoriaId === 'string' && /^\d+$/.test(body.categoriaId.trim())
            ? Number(body.categoriaId)
            : NaN;

    if (!nome || nome.length > 30) {
        throw erroHttp(400, 'O nome do produto é obrigatório e deve ter até 30 caracteres.');
    }
    if (descricao.length > 100) {
        throw erroHttp(400, 'A descrição deve ter até 100 caracteres.');
    }
    if (!Number.isFinite(preco) || preco <= 0 || preco > 99999999.99) {
        throw erroHttp(400, 'Informe um preço maior que zero e dentro do limite permitido.');
    }
    if (Math.abs(preco * 100 - Math.round(preco * 100)) > 1e-7) {
        throw erroHttp(400, 'O preço deve ter no máximo duas casas decimais.');
    }
    if (!Number.isSafeInteger(estoque) || estoque < 0 || estoque > 2147483647) {
        throw erroHttp(400, 'O estoque deve ser um número inteiro igual ou maior que zero.');
    }
    if (!Number.isSafeInteger(categoriaId) || categoriaId <= 0) {
        throw erroHttp(400, 'Selecione uma categoria válida.');
    }

    return { nome, descricao: descricao || null, preco, estoque, categoriaId };
}

function jsonErro(res, erro, mensagemPadrao) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message });
    console.error(mensagemPadrao, erro);
    res.status(500).json({ erro: mensagemPadrao });
}

function arquivoImagemGerenciado(id, imagem) {
    if (typeof imagem !== 'string') return null;
    const nomeArquivo = path.basename(imagem);
    if (nomeArquivo !== imagem ||
        !nomeArquivo.startsWith(`produto-${Number(id)}-`) ||
        !nomeArquivo.endsWith('.webp')) {
        return null;
    }
    return path.join(PASTA_IMAGENS, nomeArquivo);
}

async function listarCategorias(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT id_categoria AS id, nome_categoria AS nome
             FROM categoria
             ORDER BY nome_categoria`
        );
        res.json(rows.map(categoria => ({ ...categoria, id: Number(categoria.id) })));
    } catch (erro) {
        jsonErro(res, erro, 'Não foi possível carregar as categorias.');
    }
}

async function listarProdutos(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT ${CAMPOS_PRODUTO}
             FROM produto p
             JOIN categoria c ON c.id_categoria = p.id_categoria
             ORDER BY p.id_produto`
        );
        res.json(rows.map(produto => ({
            ...produto,
            id: Number(produto.id),
            preco: Number(produto.preco),
            estoque: Number(produto.estoque),
            categoria_id: Number(produto.categoria_id)
        })));
    } catch (erro) {
        jsonErro(res, erro, 'Não foi possível carregar os produtos.');
    }
}

async function buscarProduto(req, res) {
    if (!validarId(req.params.id)) {
        return res.status(400).json({ erro: 'Informe um ID de produto válido.' });
    }
    try {
        const { rows } = await pool.query(
            `SELECT ${CAMPOS_PRODUTO}
             FROM produto p
             JOIN categoria c ON c.id_categoria = p.id_categoria
             WHERE p.id_produto = $1`,
            [Number(req.params.id)]
        );
        if (!rows.length) return res.status(404).json({ erro: 'Produto não encontrado.' });
        const produto = rows[0];
        res.json({
            ...produto,
            id: Number(produto.id),
            preco: Number(produto.preco),
            estoque: Number(produto.estoque),
            categoria_id: Number(produto.categoria_id)
        });
    } catch (erro) {
        jsonErro(res, erro, 'Não foi possível buscar o produto.');
    }
}

async function inserirProduto(req, res) {
    let dados;
    try {
        dados = validarDados(req.body || {});
        const { rows } = await pool.query(
            `INSERT INTO produto (
                nome_prod, descricao_prod, preco, quant_estoque, id_categoria
             )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id_produto AS id`,
            [dados.nome, dados.descricao, dados.preco, dados.estoque, dados.categoriaId]
        );
        res.status(201).json({ id: Number(rows[0].id), mensagem: 'Produto cadastrado com sucesso.' });
    } catch (erro) {
        if (erro.code === '23503') {
            return res.status(400).json({ erro: 'Selecione uma categoria cadastrada.' });
        }
        jsonErro(res, erro, 'Não foi possível cadastrar o produto.');
    }
}

async function alterarProduto(req, res) {
    if (!validarId(req.params.id)) {
        return res.status(400).json({ erro: 'Informe um ID de produto válido.' });
    }
    try {
        const dados = validarDados(req.body || {});
        const resultado = await pool.query(
            `UPDATE produto
             SET nome_prod = $2,
                 descricao_prod = $3,
                 preco = $4,
                 quant_estoque = $5,
                 id_categoria = $6
             WHERE id_produto = $1`,
            [
                Number(req.params.id),
                dados.nome,
                dados.descricao,
                dados.preco,
                dados.estoque,
                dados.categoriaId
            ]
        );
        if (!resultado.rowCount) return res.status(404).json({ erro: 'Produto não encontrado.' });
        res.json({ id: Number(req.params.id), mensagem: 'Produto atualizado com sucesso.' });
    } catch (erro) {
        if (erro.code === '23503') {
            return res.status(400).json({ erro: 'Selecione uma categoria cadastrada.' });
        }
        jsonErro(res, erro, 'Não foi possível atualizar o produto.');
    }
}

async function excluirProduto(req, res) {
    if (!validarId(req.params.id)) {
        return res.status(400).json({ erro: 'Informe um ID de produto válido.' });
    }
    try {
        const { rows } = await pool.query(
            'DELETE FROM produto WHERE id_produto = $1 RETURNING imagem',
            [Number(req.params.id)]
        );
        if (!rows.length) return res.status(404).json({ erro: 'Produto não encontrado.' });

        const imagem = arquivoImagemGerenciado(req.params.id, rows[0].imagem);
        if (imagem) {
            try {
                await fs.unlink(imagem);
            } catch (erroArquivo) {
                if (erroArquivo.code !== 'ENOENT') {
                    console.error('Não foi possível remover a imagem do produto excluído:', erroArquivo);
                }
            }
        }
        res.json({ id: Number(req.params.id), mensagem: 'Produto excluído com sucesso.' });
    } catch (erro) {
        if (erro.code === '23503') {
            return res.status(409).json({
                erro: 'Este produto está associado a pedidos e não pode ser excluído.'
            });
        }
        jsonErro(res, erro, 'Não foi possível excluir o produto.');
    }
}

async function atualizarImagem(req, res) {
    if (!validarId(req.params.id)) {
        return res.status(400).json({ erro: 'Informe um ID de produto válido.' });
    }
    if (!req.file) return res.status(400).json({ erro: 'Selecione uma imagem para enviar.' });

    let imagemNova;
    try {
        const { rows } = await pool.query(
            'SELECT imagem FROM produto WHERE id_produto = $1',
            [Number(req.params.id)]
        );
        if (!rows.length) return res.status(404).json({ erro: 'Produto não encontrado.' });

        const imagemProcessada = await sharp(req.file.buffer, { failOn: 'error' })
            .rotate()
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
        const nomeArquivo = `produto-${Number(req.params.id)}-${randomUUID()}.webp`;
        imagemNova = path.join(PASTA_IMAGENS, nomeArquivo);
        await fs.mkdir(PASTA_IMAGENS, { recursive: true });
        await fs.writeFile(imagemNova, imagemProcessada, { flag: 'wx' });

        await pool.query(
            'UPDATE produto SET imagem = $2 WHERE id_produto = $1',
            [Number(req.params.id), nomeArquivo]
        );

        const imagemAntiga = arquivoImagemGerenciado(req.params.id, rows[0].imagem);
        if (imagemAntiga) {
            try {
                await fs.unlink(imagemAntiga);
            } catch (erroArquivo) {
                if (erroArquivo.code !== 'ENOENT') {
                    console.error('Não foi possível remover a imagem antiga do produto:', erroArquivo);
                }
            }
        }
        res.json({ imagem: nomeArquivo, mensagem: 'Imagem atualizada com sucesso.' });
    } catch (erro) {
        if (imagemNova) {
            try {
                await fs.unlink(imagemNova);
            } catch (erroArquivo) {
                if (erroArquivo.code !== 'ENOENT') {
                    console.error('Não foi possível limpar o arquivo de imagem temporário:', erroArquivo);
                }
            }
        }
        if (erro.code === '23503') {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }
        if (erro.message && /unsupported image format|Input buffer contains unsupported image format/i.test(erro.message)) {
            return res.status(400).json({ erro: 'O arquivo selecionado não contém uma imagem válida.' });
        }
        jsonErro(res, erro, 'Não foi possível salvar a imagem do produto.');
    }
}

module.exports = {
    listarCategorias,
    listarProdutos,
    buscarProduto,
    inserirProduto,
    alterarProduto,
    excluirProduto,
    atualizarImagem
};
