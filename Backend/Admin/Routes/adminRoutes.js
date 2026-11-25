const express = require('express');
const { exigirAdmin } = require('../../Login/loginController');
const {
    obterDashboard,
    atualizarStatusPedido
} = require('../Controller/adminController');

const router = express.Router();

router.get('/dashboard', exigirAdmin, obterDashboard);
router.patch('/pedidos/:id/status', exigirAdmin, atualizarStatusPedido);

module.exports = router;
