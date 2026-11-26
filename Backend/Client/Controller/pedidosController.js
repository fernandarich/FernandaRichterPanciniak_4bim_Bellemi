const pool = require('../../db');

async function listarFretes(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT id_frete AS id, estado, valor_frete
             FROM frete_estado
             ORDER BY estado`
        );

        res.json(rows.map(frete => ({
            ...frete,
            id: Number(frete.id),
            valor_frete: Number(frete.valor_frete)
        })));
    } catch (erro) {
        console.error('Erro ao listar opções de frete:', erro);
        res.status(500).json({ erro: 'Não foi possível carregar os estados de entrega.' });
    }
}

async function listarMeusCartoes(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT
                id_cartao AS id,
                nome_titular,
                ultimos_digitos,
                bandeira,
                tipo_cartao,
                mes_validade,
                ano_validade
             FROM cartao
             WHERE cpf_pessoa = $1
             ORDER BY id_cartao`,
            [req.usuario.id]
        );

        res.json(rows.map(cartao => ({
            ...cartao,
            id: Number(cartao.id),
            mes_validade: Number(cartao.mes_validade),
            ano_validade: Number(cartao.ano_validade)
        })));
    } catch (erro) {
        console.error('Erro ao listar cartões salvos do cliente:', erro);
        res.status(500).json({ erro: 'Não foi possível carregar os cartões salvos.' });
    }
}

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

async function criarPedidoTeste(req, res) {
    const corpo = req.body && typeof req.body === 'object' ? req.body : {};
    const { itens, idFrete, idFormaPagamento, idCartao, cartao } = corpo;

    if (
        !Array.isArray(itens) ||
        itens.length === 0 ||
        itens.length > 100 ||
        itens.some(item =>
            !item ||
            !Number.isInteger(item.id) ||
            item.id <= 0 ||
            !Number.isInteger(item.quantidade) ||
            item.quantidade <= 0
        ) ||
        new Set(itens.map(item => item.id)).size !== itens.length
    ) {
        return res.status(400).json({ erro: 'Os itens do pedido são inválidos. Confira seu carrinho.' });
    }

    if (!Number.isInteger(idFrete) || idFrete <= 0) {
        return res.status(400).json({ erro: 'Selecione um estado de entrega válido.' });
    }

    if (!Number.isInteger(idFormaPagamento) || idFormaPagamento <= 0) {
        return res.status(400).json({ erro: 'Selecione uma forma de pagamento válida.' });
    }

    if (
        (idCartao !== undefined && (!Number.isInteger(idCartao) || idCartao <= 0)) ||
        (cartao !== undefined && (!cartao || typeof cartao !== 'object' || Array.isArray(cartao))) ||
        (idCartao !== undefined && cartao !== undefined)
    ) {
        return res.status(400).json({ erro: 'Os dados do cartão informado são inválidos.' });
    }

    if (cartao) {
        const camposPermitidos = new Set([
            'nomeTitular',
            'ultimosDigitos',
            'bandeira',
            'mesValidade',
            'anoValidade'
        ]);
        if (Object.keys(cartao).some(campo => !camposPermitidos.has(campo))) {
            return res.status(400).json({ erro: 'Informe somente os dados permitidos do cartão.' });
        }

        const nomeTitular = typeof cartao.nomeTitular === 'string' ? cartao.nomeTitular.trim() : '';
        const bandeira = typeof cartao.bandeira === 'string' ? cartao.bandeira.trim() : '';
        const bandeirasPermitidas = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard'];
        if (
            !nomeTitular ||
            nomeTitular.length > 100 ||
            typeof cartao.ultimosDigitos !== 'string' ||
            !/^\d{4}$/.test(cartao.ultimosDigitos) ||
            !bandeirasPermitidas.includes(bandeira) ||
            !Number.isInteger(cartao.mesValidade) ||
            cartao.mesValidade < 1 ||
            cartao.mesValidade > 12 ||
            !Number.isInteger(cartao.anoValidade) ||
            cartao.anoValidade < new Date().getFullYear() ||
            cartao.anoValidade > new Date().getFullYear() + 30
        ) {
            return res.status(400).json({ erro: 'Confira os dados demonstrativos do cartão.' });
        }
    }

    let client;
    let transacaoIniciada = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transacaoIniciada = true;

        const { rows: fretes } = await client.query(
            'SELECT valor_frete FROM frete_estado WHERE id_frete = $1',
            [idFrete]
        );
        if (!fretes.length) {
            throw erroHttp(400, 'O estado de entrega selecionado não é válido.');
        }

        const { rows: formasPagamento } = await client.query(
            `SELECT id_formapag, forma_pag
             FROM forma_pagamento
             WHERE id_formapag = $1`,
            [idFormaPagamento]
        );
        if (!formasPagamento.length) {
            throw erroHttp(400, 'A forma de pagamento selecionada não é válida.');
        }

        const nomeForma = formasPagamento[0].forma_pag.trim();
        const nomeFormaNormalizado = nomeForma.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const tipoCartao = nomeFormaNormalizado === 'cartao de credito'
            ? 'CREDITO'
            : nomeFormaNormalizado === 'cartao de debito'
                ? 'DEBITO'
                : null;
        const ehPix = nomeFormaNormalizado === 'pix';
        const ehBoleto = nomeFormaNormalizado === 'boleto bancario';
        if (!ehPix && !ehBoleto && !tipoCartao) {
            throw erroHttp(400, 'Esta forma de pagamento ainda não está disponível.');
        }
        if (((ehPix || ehBoleto) && (idCartao !== undefined || cartao !== undefined)) ||
            (tipoCartao && idCartao === undefined && cartao === undefined)) {
            throw erroHttp(400, 'Informe os dados necessários para esta forma de pagamento.');
        }

        const idsProdutos = itens.map(item => item.id);
        const { rows: produtos } = await client.query(
            `SELECT id_produto AS id, preco
             FROM produto
             WHERE id_produto = ANY($1::integer[])`,
            [idsProdutos]
        );
        if (produtos.length !== itens.length) {
            throw erroHttp(400, 'Um ou mais produtos do carrinho não estão mais disponíveis.');
        }

        let idCartaoPagamento = null;
        if (tipoCartao && idCartao !== undefined) {
            const { rows: cartoes } = await client.query(
                `SELECT id_cartao, mes_validade, ano_validade
                 FROM cartao
                 WHERE id_cartao = $1
                   AND cpf_pessoa = $2
                   AND tipo_cartao = $3`,
                [idCartao, req.usuario.id, tipoCartao]
            );
            if (!cartoes.length) {
                throw erroHttp(400, 'O cartão selecionado não pertence à sua conta ou não corresponde ao tipo de pagamento.');
            }
            const anoAtual = new Date().getFullYear();
            const mesAtual = new Date().getMonth() + 1;
            if (
                Number(cartoes[0].ano_validade) < anoAtual ||
                (Number(cartoes[0].ano_validade) === anoAtual &&
                    Number(cartoes[0].mes_validade) < mesAtual)
            ) {
                throw erroHttp(400, 'O cartão salvo está vencido. Cadastre outro cartão para continuar.');
            }
            idCartaoPagamento = Number(cartoes[0].id_cartao);
        } else if (tipoCartao) {
            const anoAtual = new Date().getFullYear();
            const mesAtual = new Date().getMonth() + 1;
            if (
                cartao.anoValidade < anoAtual ||
                (cartao.anoValidade === anoAtual && cartao.mesValidade < mesAtual)
            ) {
                throw erroHttp(400, 'O cartão demonstrativo está vencido.');
            }

            const { rows: cartoes } = await client.query(
                `INSERT INTO cartao (
                    cpf_pessoa,
                    nome_titular,
                    ultimos_digitos,
                    bandeira,
                    tipo_cartao,
                    mes_validade,
                    ano_validade
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id_cartao`,
                [
                    req.usuario.id,
                    cartao.nomeTitular.trim(),
                    cartao.ultimosDigitos,
                    cartao.bandeira.trim(),
                    tipoCartao,
                    cartao.mesValidade,
                    cartao.anoValidade
                ]
            );
            idCartaoPagamento = Number(cartoes[0].id_cartao);
        }

        const produtosPorId = new Map(produtos.map(produto => [Number(produto.id), produto]));
        const totalProdutos = itens.reduce((total, item) => {
            return total + Number(produtosPorId.get(item.id).preco) * item.quantidade;
        }, 0);
        const valorTotal = Math.round((totalProdutos + Number(fretes[0].valor_frete)) * 100) / 100;

        const statusPedido = ehPix ? 'Aguardando pagamento' : 'Pago';
        const { rows: pedidos } = await client.query(
            `INSERT INTO pedido (cpf_pessoa, data_pedido, status_pedido, id_frete)
             VALUES ($1, CURRENT_DATE, $3, $2)
             RETURNING id_pedido`,
            [req.usuario.id, idFrete, statusPedido]
        );
        const idPedido = pedidos[0].id_pedido;

        for (const item of itens) {
            const produto = produtosPorId.get(item.id);
            await client.query(
                `INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
                 VALUES ($1, $2, $3, $4)`,
                [idPedido, item.id, item.quantidade, produto.preco]
            );
        }

        await client.query(
            `INSERT INTO pagamento (
                id_pedido,
                valor_pagamento,
                id_formapag,
                status_pagamento,
                data_pagamento,
                id_cartao
             )
             VALUES (
                $1, $2, $3,
                CASE WHEN $5 THEN 'Pendente' ELSE 'Aprovado' END,
                CASE WHEN $5 THEN NULL ELSE CURRENT_DATE END,
                $4
             )`,
            [idPedido, valorTotal, idFormaPagamento, idCartaoPagamento, ehPix]
        );

        await client.query('COMMIT');
        transacaoIniciada = false;
        res.status(201).json({ id: Number(idPedido), total: valorTotal });
    } catch (erro) {
        if (client && transacaoIniciada) {
            try {
                await client.query('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer criação do pedido:', erroRollback);
            }
        }

        if (erro.status) {
            return res.status(erro.status).json({ erro: erro.message });
        }

        console.error('Erro ao criar pedido de demonstração:', erro);
        res.status(500).json({ erro: 'Não foi possível registrar o pedido.' });
    } finally {
        if (client) client.release();
    }
}

async function listarMeusPedidos(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT
                ped.id_pedido AS id,
                TO_CHAR(ped.data_pedido, 'YYYY-MM-DD') AS data,
                ped.status_pedido AS status,
                COALESCE(
                    pag.valor_pagamento,
                    COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0) + frete.valor_frete
                ) AS total,
                frete.estado AS estado_entrega,
                frete.valor_frete AS valor_frete,
                forma.forma_pag AS forma_pagamento,
                pag.status_pagamento AS status_pagamento,
                dev.status_devolucao,
                dev.motivo AS motivo_devolucao,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'idProduto', prod.id_produto,
                            'nome', prod.nome_prod,
                            'quantidade', ip.quantidade,
                            'precoUnitario', ip.preco_unitario,
                            'subtotal', ip.quantidade * ip.preco_unitario
                        )
                        ORDER BY prod.nome_prod
                    ) FILTER (WHERE ip.id_produto IS NOT NULL),
                    '[]'::json
                ) AS itens
             FROM pedido ped
             JOIN frete_estado frete ON frete.id_frete = ped.id_frete
             LEFT JOIN item_pedido ip ON ip.id_pedido = ped.id_pedido
             LEFT JOIN produto prod ON prod.id_produto = ip.id_produto
             LEFT JOIN pagamento pag ON pag.id_pedido = ped.id_pedido
             LEFT JOIN forma_pagamento forma ON forma.id_formapag = pag.id_formapag
             LEFT JOIN devolucao dev ON dev.id_pedido = ped.id_pedido
             WHERE ped.cpf_pessoa = $1
             GROUP BY
                ped.id_pedido,
                ped.data_pedido,
                ped.status_pedido,
                pag.valor_pagamento,
                frete.estado,
                frete.valor_frete,
                forma.forma_pag,
                pag.status_pagamento,
                dev.status_devolucao,
                dev.motivo
             ORDER BY ped.data_pedido DESC, ped.id_pedido DESC`,
            [req.usuario.id]
        );

        res.json(rows.map(pedido => ({
            ...pedido,
            id: Number(pedido.id),
            total: Number(pedido.total),
            valor_frete: Number(pedido.valor_frete),
            itens: pedido.itens.map(item => ({
                ...item,
                idProduto: Number(item.idProduto),
                quantidade: Number(item.quantidade),
                precoUnitario: Number(item.precoUnitario),
                subtotal: Number(item.subtotal)
            }))
        })));
    } catch (erro) {
        console.error('Erro ao listar pedidos do cliente:', erro);
        res.status(500).json({ erro: 'Não foi possível carregar seus pedidos.' });
    }
}

function normalizarStatus(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function validarIdPedido(valor) {
    return /^\d+$/.test(String(valor)) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0;
}

async function solicitarDevolucao(req, res) {
    const idPedido = req.params.id;
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (!validarIdPedido(idPedido)) return res.status(400).json({ erro: 'Pedido inválido.' });
    if (motivo.length > 500) return res.status(400).json({ erro: 'O motivo deve ter até 500 caracteres.' });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: pedidos } = await client.query(
            `SELECT status_pedido
             FROM pedido
             WHERE id_pedido = $1 AND cpf_pessoa = $2
             FOR UPDATE`,
            [Number(idPedido), req.usuario.id]
        );
        if (!pedidos.length) throw erroHttp(404, 'Pedido não encontrado.');
        if (normalizarStatus(pedidos[0].status_pedido) === 'cancelado') {
            throw erroHttp(409, 'Não é possível pedir devolução de um pedido cancelado.');
        }

        const { rows } = await client.query(
            `INSERT INTO devolucao (id_pedido, motivo)
             VALUES ($1, $2)
             ON CONFLICT (id_pedido) DO NOTHING
             RETURNING id_devolucao AS id, id_pedido, motivo, status_devolucao, data_solicitacao`,
            [Number(idPedido), motivo || null]
        );
        if (!rows.length) throw erroHttp(409, 'Já existe uma solicitação de devolução para este pedido.');
        await client.query('COMMIT');
        return res.status(201).json(rows[0]);
    } catch (erro) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (erroRollback) {
                console.error('Erro ao desfazer solicitação de devolução:', erroRollback);
            }
        }
        if (erro.status) return res.status(erro.status).json({ erro: erro.message });
        console.error('Erro ao solicitar devolução:', erro);
        return res.status(500).json({ erro: 'Não foi possível solicitar a devolução.' });
    } finally {
        if (client) client.release();
    }
}

async function cancelarPedidoCliente(req, res) {
    const idPedido = req.params.id;
    if (!validarIdPedido(idPedido)) return res.status(400).json({ erro: 'Pedido inválido.' });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT ped.status_pedido, pag.status_pagamento
             FROM pedido ped
             LEFT JOIN pagamento pag ON pag.id_pedido = ped.id_pedido
             WHERE ped.id_pedido = $1 AND ped.cpf_pessoa = $2
             FOR UPDATE OF ped`,
            [Number(idPedido), req.usuario.id]
        );
        if (!rows.length) throw erroHttp(404, 'Pedido não encontrado.');

        const pedido = rows[0];
        const statusPedido = normalizarStatus(pedido.status_pedido);
        const statusPagamento = normalizarStatus(pedido.status_pagamento);
        const pagamentoConfirmado = ['aprovado', 'pago'].includes(statusPagamento);
        const pagamentoPendente = ['pendente', 'aguardando pagamento'].includes(statusPedido) ||
            statusPagamento === 'pendente';
        if (!pagamentoPendente || pagamentoConfirmado || statusPagamento === 'cancelado' || statusPedido === 'cancelado') {
            throw erroHttp(409, 'Só é possível cancelar antes da confirmação do pagamento.');
        }

        await client.query('UPDATE pedido SET status_pedido = $2 WHERE id_pedido = $1', [Number(idPedido), 'Cancelado']);
        await client.query(
            `UPDATE pagamento
             SET status_pagamento = 'Cancelado', data_pagamento = NULL
             WHERE id_pedido = $1 AND LOWER(status_pagamento) = 'pendente'`,
            [Number(idPedido)]
        );
        await client.query('COMMIT');
        return res.json({ id: Number(idPedido), status: 'Cancelado' });
    } catch (erro) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (erroRollback) {
                console.error('Erro ao desfazer cancelamento do pedido:', erroRollback);
            }
        }
        if (erro.status) return res.status(erro.status).json({ erro: erro.message });
        console.error('Erro ao cancelar pedido do cliente:', erro);
        return res.status(500).json({ erro: 'Não foi possível cancelar o pedido.' });
    } finally {
        if (client) client.release();
    }
}

module.exports = {
    listarFretes,
    listarMeusCartoes,
    criarPedidoTeste,
    listarMeusPedidos,
    solicitarDevolucao,
    cancelarPedidoCliente
};
