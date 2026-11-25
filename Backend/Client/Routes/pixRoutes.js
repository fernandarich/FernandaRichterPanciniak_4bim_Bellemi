const express = require('express');
const { exigirCliente } = require('../../Login/loginController');
const { gerarQrCode } = require('../Controller/pixController');

const router = express.Router();

router.post('/qrcode', exigirCliente, gerarQrCode);

module.exports = router;