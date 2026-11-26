const express = require('express');
const { exigirAdmin } = require('../../Login/loginController');
const {
    listarFuncionarios,
    criarFuncionario,
    atualizarFuncionario,
    excluirFuncionario
} = require('../Controller/funcionarioController');

const router = express.Router();

router.use(exigirAdmin);
router.get('/', listarFuncionarios);
router.post('/', criarFuncionario);
router.put('/:cpf', atualizarFuncionario);
router.delete('/:cpf', excluirFuncionario);

module.exports = router;
