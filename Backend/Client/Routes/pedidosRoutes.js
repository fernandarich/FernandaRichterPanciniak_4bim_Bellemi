    const express = require('express');
    const { exigirCliente } = require('../../Login/loginController');
    const {
        listarFretes,
        listarMeusCartoes,
        criarPedidoTeste,
        listarMeusPedidos
    } = require('../Controller/pedidosController');

    const router = express.Router();

    router.get('/fretes', listarFretes);
    router.get('/cartoes', exigirCliente, listarMeusCartoes);
    router.get('/', exigirCliente, listarMeusPedidos);
    router.post('/', exigirCliente, criarPedidoTeste);

    module.exports = router;
