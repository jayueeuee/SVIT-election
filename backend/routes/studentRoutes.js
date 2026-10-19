const express = require('express');

const studentController = require('../controllers/studentController');

const router = express.Router();

router.post('/signup', studentController.signup);

router.post('/login', studentController.login);

module.exports = router;