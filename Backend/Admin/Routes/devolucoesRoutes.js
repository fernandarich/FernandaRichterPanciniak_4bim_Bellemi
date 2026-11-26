const express = require('express');
const { exigirAdmin } = require('../../Login/loginController');
const { listarDevolucoes, aceitarDevolucao } = require('../Controller/devolucoesController');

const router = express.Router();

router.use(exigirAdmin);
router.get('/', listarDevolucoes);
router.patch('/:id/aceitar', aceitarDevolucao);

module.exports = router;
