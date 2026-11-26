    const express = require('express');
    const { exigirCliente } = require('../../Login/loginController');
    const {
        listarFretes,
        listarMeusCartoes,
        criarPedidoTeste,
        listarMeusPedidos,
        solicitarDevolucao,
        cancelarPedidoCliente
    } = require('../Controller/pedidosController');

    const router = express.Router();

    router.get('/fretes', listarFretes);
    router.get('/cartoes', exigirCliente, listarMeusCartoes);
    router.get('/', exigirCliente, listarMeusPedidos);
    router.post('/', exigirCliente, criarPedidoTeste);
    router.post('/:id/devolucoes', exigirCliente, solicitarDevolucao);
    router.patch('/:id/cancelar', exigirCliente, cancelarPedidoCliente);

    module.exports = router;
