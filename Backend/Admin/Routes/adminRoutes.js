const express = require('express');
const { exigirAdmin } = require('../../Login/loginController');
const { obterDashboard } = require('../Controller/adminController');

const router = express.Router();

router.get('/dashboard', exigirAdmin, obterDashboard);

module.exports = router;
