const express = require('express');
const { listar, categorias} = require('../Controller/maquiagemController');

const router = express.Router();

router.get('/produtos', listar);
router.get('/categorias', categorias);

module.exports = router;