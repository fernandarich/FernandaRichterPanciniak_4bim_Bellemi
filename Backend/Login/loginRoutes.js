const express = require('express');
const {
    login,
    selecionarPerfil,
    cadastrarCliente,
    consultarConta,
    atualizarConta,
    verificarSessao,
    exigirCliente,
    encerrarSessao
} = require('./loginController');

const router = express.Router();

router.post('/login', login);
router.post('/selecionar-perfil', selecionarPerfil);
router.post('/clientes', cadastrarCliente);
router.get('/conta', exigirCliente, consultarConta);
router.put('/conta', exigirCliente, atualizarConta);
router.get('/sessao', verificarSessao);
router.delete('/sessao', encerrarSessao);

module.exports = router;
