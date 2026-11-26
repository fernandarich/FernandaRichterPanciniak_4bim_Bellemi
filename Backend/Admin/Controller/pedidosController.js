const pool = require('../../db');

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function numeroSeguro(valor) {
    const numero = Number(valor);
    return Number.isSafeInteger(numero) && numero > 0;
}

function normalizarStatus(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

async function listarPedidos(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT
                ped.id_pedido AS id,
                pessoa.nome_pessoa AS cliente,
                TO_CHAR(ped.data_pedido, 'YYYY-MM-DD') AS data,
                COALESCE(
                    pag.valor_pagamento,
                    COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0) + frete.valor_frete
                ) AS total,
                ped.status_pedido AS status,
                COALESCE(pag.status_pagamento, 'Não informado') AS status_pagamento,
                COALESCE(forma.forma_pag, 'Não informado') AS forma_pagamento,
                frete.estado AS estado_entrega,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'idProduto', prod.id_produto,
                            'nome', prod.nome_prod,
                            'quantidade', ip.quantidade,
                            'precoUnitario', ip.preco_unitario,
                            'subtotal', ip.quantidade * ip.preco_unitario
                        ) ORDER BY prod.nome_prod
                    ) FILTER (WHERE ip.id_produto IS NOT NULL),
                    '[]'::json
                ) AS itens
             FROM pedido ped
             JOIN pessoa ON pessoa.cpf_pessoa = ped.cpf_pessoa
             JOIN frete_estado frete ON frete.id_frete = ped.id_frete
             LEFT JOIN item_pedido ip ON ip.id_pedido = ped.id_pedido
             LEFT JOIN produto prod ON prod.id_produto = ip.id_produto
             LEFT JOIN pagamento pag ON pag.id_pedido = ped.id_pedido
             LEFT JOIN forma_pagamento forma ON forma.id_formapag = pag.id_formapag
             GROUP BY
                ped.id_pedido, pessoa.nome_pessoa, ped.data_pedido,
                pag.valor_pagamento, ped.status_pedido, pag.status_pagamento,
                forma.forma_pag, frete.estado, frete.valor_frete
             ORDER BY ped.data_pedido DESC, ped.id_pedido DESC`
        );

        res.json(rows.map(pedido => {
            let itens = pedido.itens;
            if (typeof itens === 'string') {
                try {
                    itens = JSON.parse(itens);
                } catch {
                    itens = [];
                }
            }
            if (!Array.isArray(itens)) itens = [];

            return {
                ...pedido,
                id: Number(pedido.id),
                total: Number(pedido.total),
                itens: itens.map(item => {
                    const quantidade = Number(item.quantidade || 0);
                    const precoUnitario = Number(item.precoUnitario || 0);
                    return {
                        ...item,
                        idProduto: item.idProduto === null || item.idProduto === undefined
                            ? null
                            : Number(item.idProduto),
                        nome: item.nome || item.nome_prod || 'Produto',
                        quantidade,
                        precoUnitario,
                        subtotal: item.subtotal === null || item.subtotal === undefined
                            ? quantidade * precoUnitario
                            : Number(item.subtotal)
                    };
                })
            };
        }));
    } catch (erro) {
        console.error('Erro ao listar pedidos do painel administrativo:', erro);
        res.status(500).json({ erro: 'Não foi possível carregar os pedidos.' });
    }
}

async function atualizarStatusPedido(req, res) {
    const idPedido = req.params.id;
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    const statusEntregaPermitidos = ['Em Separação', 'Enviado', 'Entregue'];
    if (!numeroSeguro(idPedido) || !['Aprovado', 'Cancelado', ...statusEntregaPermitidos].includes(status)) {
        return res.status(400).json({ erro: 'Informe um pedido e um status válidos.' });
    }

    let client;
    let transacaoIniciada = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transacaoIniciada = true;

        const { rows } = await client.query(
            `SELECT ped.status_pedido, pag.id_pagamento, pag.status_pagamento
             FROM pedido ped
             LEFT JOIN pagamento pag ON pag.id_pedido = ped.id_pedido
             WHERE ped.id_pedido = $1
             FOR UPDATE OF ped`,
            [Number(idPedido)]
        );
        if (!rows.length) throw erroHttp(404, 'O pedido não foi encontrado.');

        const pedido = rows[0];
        const statusPedidoAtual = normalizarStatus(pedido.status_pedido);
        const statusPagamentoAtual = normalizarStatus(pedido.status_pagamento);
        const pagamentoPendente = ['pendente', 'aguardando pagamento'].includes(statusPedidoAtual) ||
            statusPagamentoAtual === 'pendente';

        if (status === 'Aprovado' || status === 'Cancelado') {
            if (!pagamentoPendente) {
                throw erroHttp(409, 'Este pedido não está aguardando confirmação de pagamento.');
            }
            if (!pedido.id_pagamento) {
                throw erroHttp(409, 'O pedido não possui pagamento para atualizar.');
            }

            const statusPedido = status === 'Aprovado' ? 'Pago' : 'Cancelado';
            await client.query(
                'UPDATE pedido SET status_pedido = $2 WHERE id_pedido = $1',
                [Number(idPedido), statusPedido]
            );
            await client.query(
                `UPDATE pagamento
                 SET status_pagamento = $2,
                     data_pagamento = CASE WHEN $3 THEN CURRENT_DATE ELSE NULL END
                 WHERE id_pedido = $1`,
                [Number(idPedido), status, status === 'Aprovado']
            );
        } else {
            if (!['aprovado', 'pago'].includes(statusPagamentoAtual) && statusPedidoAtual !== 'pago') {
                throw erroHttp(409, 'Confirme o pagamento antes de atualizar a entrega.');
            }

            const proximosStatus = {
                aprovado: ['Em Separação'],
                pago: ['Em Separação'],
                'em separacao': ['Enviado'],
                enviado: ['Entregue']
            };
            if (!proximosStatus[statusPedidoAtual]?.includes(status)) {
                throw erroHttp(409, 'Esse status não é a próxima etapa permitida para o pedido.');
            }

            await client.query(
                'UPDATE pedido SET status_pedido = $2 WHERE id_pedido = $1',
                [Number(idPedido), status]
            );
        }

        await client.query('COMMIT');
        transacaoIniciada = false;
        res.json({ id: Number(idPedido), status });
    } catch (erro) {
        if (client && transacaoIniciada) {
            try {
                await client.query('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer atualização do pedido:', erroRollback);
            }
        }
        if (erro.status) return res.status(erro.status).json({ erro: erro.message });
        console.error('Erro ao atualizar status do pedido:', erro);
        res.status(500).json({ erro: 'Não foi possível atualizar o pedido.' });
    } finally {
        if (client) client.release();
    }
}

module.exports = { listarPedidos, atualizarStatusPedido };
