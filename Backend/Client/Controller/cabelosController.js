const pool = require('../../db');

const ORDENS = {
    nome: 'p.nome_prod ASC',
    menor_preco: 'p.preco ASC, p.nome_prod ASC',
    maior_preco: 'p.preco DESC, p.nome_prod ASC'
};

async function listar(req, res) {
    try {
        const busca = String(req.query.busca || '').trim().slice(0, 80);
        const ordem = ORDENS[req.query.ordem] || ORDENS.nome;

        const { rows } = await pool.query(
            `SELECT
                p.id_produto AS id,
                p.nome_prod AS nome,
                p.descricao_prod AS descricao,
                p.preco,
                p.imagem,
                p.quant_estoque AS estoque
             FROM produto p
             JOIN categoria c ON c.id_categoria = p.id_categoria
             WHERE LOWER(c.nome_categoria) = LOWER($1)
               AND (
                    $2::text = ''
                    OR p.nome_prod ILIKE '%' || $2::text || '%'
                    OR p.descricao_prod ILIKE '%' || $2::text || '%'
               )
             ORDER BY ${ordem}
             LIMIT 100`,
            ['Cabelo', busca]
        );

        res.json(rows.map(produto => ({
            ...produto,
            preco: Number(produto.preco)
        })));
    } catch (erro) {
        console.error('Erro ao listar produtos de cabelo:', erro);
        res.status(500).json({
            erro: 'Não foi possível carregar os produtos de cabelo.'
        });
    }
}

module.exports = { listar };
