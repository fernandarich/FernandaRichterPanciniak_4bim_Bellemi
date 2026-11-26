const express = require('express');
const { exigirAdmin } = require('../../Login/loginController');
const { listarClientes, criarCliente, atualizarCliente, excluirCliente } = require('../Controller/clienteController');

const router = express.Router();

router.use(exigirAdmin);
router.get('/', listarClientes);
router.post('/', criarCliente);
router.put('/:cpf', atualizarCliente);
router.delete('/:cpf', excluirCliente);

module.exports = router;
