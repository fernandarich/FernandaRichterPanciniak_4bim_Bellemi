
const pool = require('../../db');

// Ordens permitidas
const ORDENS = {
    nome: 'p.nome_prod ASC',
    menor_preco: 'p.preco ASC, p.nome_prod ASC',
    maior_preco: 'p.preco DESC, p.nome_prod ASC'
};

// GET /api/produtos?categoria=Maquiagem&busca=batom&ordem=menor_preco
async function listar(req, res) {
    try {
        const busca = String(req.query.busca || '').trim().slice(0, 80);
        const categoria = String(req.query.categoria || '').trim().slice(0, 50);

        const ordem = ORDENS[req.query.ordem] || ORDENS.nome;

        const { rows } = await pool.query(
            `SELECT
                p.id_produto AS id,
                p.nome_prod AS nome,
                p.descricao_prod AS descricao,
                p.preco,
                p.imagem,
                p.quant_estoque AS estoque,
                c.nome_categoria AS categoria

            FROM produto p

            JOIN categoria c
                ON c.id_categoria = p.id_categoria

            WHERE
                ($1::text = ''
                OR p.nome_prod ILIKE '%' || $1::text || '%'
                OR p.descricao_prod ILIKE '%' || $1::text || '%')

                AND ($2::text = ''
                OR LOWER(c.nome_categoria) = LOWER($2::text))

            ORDER BY ${ordem}

            LIMIT 100`,
            [busca, categoria]
        );

        // Converte NUMERIC para número
        res.json(rows.map(r => ({
            ...r,
            preco: Number(r.preco)
        })));

    } catch (erro) {
        console.error('Erro ao listar produtos:', erro);

        res.status(500).json({
            erro: 'Não foi possível carregar os produtos.'
        });
    }
}


// GET /api/categorias
async function categorias(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT
                id_categoria AS id,
                nome_categoria AS nome
             FROM categoria
             ORDER BY nome_categoria`
        );

        res.json(rows);

    } catch (erro) {
        console.error('Erro ao listar categorias:', erro);

        res.status(500).json({
            erro: 'Não foi possível carregar as categorias.'
        });
    }
}


module.exports = {
    listar,
    categorias
};
