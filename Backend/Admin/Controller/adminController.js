const pool = require('../../db');

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

const consultaPedidos = `
    SELECT
        ped.id_pedido AS id,
        pessoa.nome_pessoa AS cliente,
        TO_CHAR(ped.data_pedido, 'DD/MM/YYYY') AS data,
        COALESCE(
            pag.valor_pagamento,
            COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0) + frete.valor_frete
        ) AS total,
        ped.status_pedido AS status,
        COALESCE(pag.status_pagamento, 'Não informado') AS status_pagamento,
        COALESCE(forma.forma_pag, 'Não informado') AS forma_pagamento,
        COALESCE(
            STRING_AGG(
                ip.quantidade::text || 'x ' || prod.nome_prod,
                ' • ' ORDER BY prod.nome_prod
            ) FILTER (WHERE ip.id_produto IS NOT NULL),
            'Nenhum item'
        ) AS itens
    FROM pedido ped
    JOIN pessoa ON pessoa.cpf_pessoa = ped.cpf_pessoa
    JOIN frete_estado frete ON frete.id_frete = ped.id_frete
    LEFT JOIN item_pedido ip ON ip.id_pedido = ped.id_pedido
    LEFT JOIN produto prod ON prod.id_produto = ip.id_produto
    LEFT JOIN pagamento pag ON pag.id_pedido = ped.id_pedido
    LEFT JOIN forma_pagamento forma ON forma.id_formapag = pag.id_formapag
`;

async function obterDashboard(req, res) {
    try {
        const [
            pedidos,
            produtos,
            clientes,
            maisVendidos,
            pendentes,
            quantidadePendentes,
            recentes
        ] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS total FROM pedido'),
            pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(DISTINCT id_categoria)::int AS categorias
                 FROM produto`
            ),
            pool.query('SELECT COUNT(*)::int AS total FROM cliente'),
            pool.query(
                `SELECT
                    prod.id_produto AS id,
                    prod.nome_prod AS nome,
                    SUM(ip.quantidade)::int AS quantidade
                 FROM item_pedido ip
                 JOIN produto prod ON prod.id_produto = ip.id_produto
                 JOIN pedido ped ON ped.id_pedido = ip.id_pedido
                 LEFT JOIN pagamento pag ON pag.id_pedido = ped.id_pedido
                 WHERE LOWER(ped.status_pedido) NOT IN (
                    'cancelado', 'pendente', 'aguardando pagamento'
                 )
                   AND LOWER(COALESCE(pag.status_pagamento, '')) NOT IN (
                    'cancelado', 'estornado', 'pendente'
                 )
                 GROUP BY prod.id_produto, prod.nome_prod
                 ORDER BY quantidade DESC, prod.nome_prod
                 LIMIT 3`
            ),
            pool.query(
                `${consultaPedidos}
                 WHERE LOWER(ped.status_pedido) IN ('pendente', 'aguardando pagamento')
                    OR LOWER(COALESCE(pag.status_pagamento, '')) = 'pendente'
                 GROUP BY
                    ped.id_pedido, pessoa.nome_pessoa, ped.data_pedido,
                    pag.valor_pagamento, frete.valor_frete, ped.status_pedido,
                    pag.status_pagamento, forma.forma_pag
                 ORDER BY ped.data_pedido DESC, ped.id_pedido DESC
                 LIMIT 5`
            ),
            pool.query(
                `SELECT COUNT(DISTINCT ped.id_pedido)::int AS total
                 FROM pedido ped
                 LEFT JOIN pagamento pag ON pag.id_pedido = ped.id_pedido
                 WHERE LOWER(ped.status_pedido) IN ('pendente', 'aguardando pagamento')
                    OR LOWER(COALESCE(pag.status_pagamento, '')) = 'pendente'`
            ),
            pool.query(
                `${consultaPedidos}
                 GROUP BY
                    ped.id_pedido, pessoa.nome_pessoa, ped.data_pedido,
                    pag.valor_pagamento, frete.valor_frete, ped.status_pedido,
                    pag.status_pagamento, forma.forma_pag
                 ORDER BY ped.data_pedido DESC, ped.id_pedido DESC
                 LIMIT 10`
            )
        ]);

        res.json({
            resumo: {
                totalPedidos: pedidos.rows[0].total,
                totalProdutos: produtos.rows[0].total,
                categoriasComProdutos: produtos.rows[0].categorias,
                totalClientes: clientes.rows[0].total,
                pedidosPendentes: quantidadePendentes.rows[0].total
            },
            maisVendidos: maisVendidos.rows.map(produto => ({
                id: Number(produto.id),
                nome: produto.nome,
                quantidade: Number(produto.quantidade)
            })),
            pendentes: pendentes.rows.map(pedido => ({
                ...pedido,
                id: Number(pedido.id),
                total: Number(pedido.total)
            })),
            recentes: recentes.rows.map(pedido => ({
                ...pedido,
                id: Number(pedido.id),
                total: Number(pedido.total)
            }))
        });
    } catch (erro) {
        console.error('Erro ao carregar o painel administrativo:', erro);
        res.status(500).json({ erro: 'Não foi possível carregar os dados do painel.' });
    }
}

async function atualizarStatusPedido(req, res) {
    const idPedido = Number(req.params.id);
    const { status } = req.body || {};
    if (!Number.isSafeInteger(idPedido) || idPedido <= 0 ||
        !['Aprovado', 'Cancelado'].includes(status)) {
        return res.status(400).json({ erro: 'Informe um pedido e uma ação válidos.' });
    }

    let client;
    let transacaoIniciada = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transacaoIniciada = true;

        const { rows } = await client.query(
            `SELECT
                ped.status_pedido,
                pag.id_pagamento,
                pag.status_pagamento
             FROM pedido ped
             LEFT JOIN pagamento pag ON pag.id_pedido = ped.id_pedido
             WHERE ped.id_pedido = $1
             FOR UPDATE OF ped`,
            [idPedido]
        );
        if (!rows.length) throw erroHttp(404, 'O pedido não foi encontrado.');

        const pedido = rows[0];
        const statusPedido = pedido.status_pedido.toLowerCase();
        const statusPagamento = (pedido.status_pagamento || '').toLowerCase();
        const estaPendente = ['pendente', 'aguardando pagamento'].includes(statusPedido) ||
            statusPagamento === 'pendente';
        if (!estaPendente) {
            throw erroHttp(409, 'Este pedido não está mais aguardando confirmação.');
        }
        if (!pedido.id_pagamento) {
            throw erroHttp(409, 'O pedido não possui um pagamento para atualizar.');
        }

        await client.query(
            'UPDATE pedido SET status_pedido = $2 WHERE id_pedido = $1',
            [idPedido, status]
        );
        await client.query(
            `UPDATE pagamento
             SET status_pagamento = $2,
                 data_pagamento = CASE WHEN $3 THEN CURRENT_DATE ELSE NULL END
             WHERE id_pedido = $1`,
            [idPedido, status, status === 'Aprovado']
        );

        await client.query('COMMIT');
        transacaoIniciada = false;
        res.json({ id: idPedido, status });
    } catch (erro) {
        if (client && transacaoIniciada) {
            try {
                await client.query('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer atualização do pedido:', erroRollback);
            }
        }

        if (erro.status) return res.status(erro.status).json({ erro: erro.message });
        console.error('Erro ao atualizar status do pedido no painel:', erro);
        res.status(500).json({ erro: 'Não foi possível atualizar o pedido.' });
    } finally {
        if (client) client.release();
    }
}

module.exports = { obterDashboard, atualizarStatusPedido };
