const pool = require('../../db');

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function validarId(id) {
    return /^\d+$/.test(String(id)) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
}

async function listarDevolucoes(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT
                d.id_devolucao AS id,
                d.id_pedido AS pedido,
                p.nome_pessoa AS cliente,
                TO_CHAR(d.data_solicitacao, 'DD/MM/YYYY HH24:MI') AS data_solicitacao,
                d.motivo,
                d.status_devolucao AS status,
                ped.status_pedido AS status_pedido
             FROM devolucao d
             INNER JOIN pedido ped ON ped.id_pedido = d.id_pedido
             INNER JOIN pessoa p ON p.cpf_pessoa = ped.cpf_pessoa
             ORDER BY d.data_solicitacao DESC, d.id_devolucao DESC`
        );
        return res.json(rows.map(devolucao => ({
            ...devolucao,
            id: Number(devolucao.id),
            pedido: Number(devolucao.pedido)
        })));
    } catch (erro) {
        console.error('Erro ao listar devoluções no painel administrativo:', erro);
        return res.status(500).json({ erro: 'Não foi possível carregar as devoluções.' });
    }
}

async function aceitarDevolucao(req, res) {
    const id = req.params.id;
    if (!validarId(id)) return res.status(400).json({ erro: 'Solicitação inválida.' });

    let client;
    let transacaoIniciada = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transacaoIniciada = true;
        const { rows } = await client.query(
            `SELECT status_devolucao
             FROM devolucao
             WHERE id_devolucao = $1
             FOR UPDATE`,
            [Number(id)]
        );
        if (!rows.length) throw erroHttp(404, 'Solicitação de devolução não encontrada.');
        if (String(rows[0].status_devolucao).toLowerCase() !== 'pendente') {
            throw erroHttp(409, 'Esta solicitação já foi analisada.');
        }

        const atualizada = await client.query(
            `UPDATE devolucao
             SET status_devolucao = 'Aceita'
             WHERE id_devolucao = $1
             RETURNING id_devolucao AS id, id_pedido AS pedido, status_devolucao AS status`,
            [Number(id)]
        );
        await client.query('COMMIT');
        transacaoIniciada = false;
        return res.json({
            ...atualizada.rows[0],
            id: Number(atualizada.rows[0].id),
            pedido: Number(atualizada.rows[0].pedido)
        });
    } catch (erro) {
        if (client && transacaoIniciada) {
            try { await client.query('ROLLBACK'); } catch (erroRollback) {
                console.error('Erro ao desfazer aceite da devolução:', erroRollback);
            }
        }
        if (erro.status) return res.status(erro.status).json({ erro: erro.message });
        console.error('Erro ao aceitar devolução:', erro);
        return res.status(500).json({ erro: 'Não foi possível aceitar a devolução.' });
    } finally {
        if (client) client.release();
    }
}

module.exports = { listarDevolucoes, aceitarDevolucao };
