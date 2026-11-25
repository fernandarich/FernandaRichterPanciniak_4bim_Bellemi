const express = require('express');
const { listar } = require('../Controller/skincareController');

const router = express.Router();

router.get('/produtos', listar);

module.exports = router;
