const express = require('express');
const electionController = require('../controllers/electionController');
const { authenticateProfessor } = require('../middleware/auth');

const router = express.Router();

router.post('/:positionId/candidates', authenticateProfessor, electionController.addCandidate);

module.exports = router;
