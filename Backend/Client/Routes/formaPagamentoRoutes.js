const express = require('express');
const { listar } = require('../Controller/formaPagamentoController');

const router = express.Router();

router.get('/formas-pagamento', listar);

module.exports = router;
