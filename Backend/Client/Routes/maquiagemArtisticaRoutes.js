const express = require('express');
const { listar } = require('../Controller/maquiagemArtisticaController');

const router = express.Router();

router.get('/produtos', listar);

module.exports = router;
