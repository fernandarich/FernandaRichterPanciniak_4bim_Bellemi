const express = require('express');
const { exigirAdmin } = require('../../Login/loginController');
const {
    listarPedidos,
    atualizarStatusPedido
} = require('../Controller/pedidosController');

const router = express.Router();

router.use(exigirAdmin);
router.get('/', listarPedidos);
router.patch('/:id/status', atualizarStatusPedido);

module.exports = router;
