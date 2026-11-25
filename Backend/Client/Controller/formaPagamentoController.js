const pool = require('../../db');

async function listar(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT
                id_formapag AS id,
                forma_pag AS nome
             FROM FORMA_PAGAMENTO
             ORDER BY forma_pag`
        );

        res.json(rows);
    } catch (erro) {
        console.error('Erro ao listar formas de pagamento:', erro);

        res.status(500).json({
            erro: 'Não foi possível carregar as formas de pagamento.'
        });
    }
}

module.exports = {
    listar
};
