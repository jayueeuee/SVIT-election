const express = require('express');
const rateLimit = require('express-rate-limit');

const professorController = require('../controllers/professorController');

const { authenticateProfessor } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Please try again later.'
  },
});

router.post('/login', loginLimiter, professorController.login);

router.post('/signup', professorController.signup);

router.get(
  '/me',
  authenticateProfessor,
  professorController.me
);


/* ================================
   STUDENT REQUESTS
   ================================ */

// Get all student requests
router.get(
  '/student-requests',
  authenticateProfessor,
  professorController.getStudentRequests
);

// Approve / Reject student request
router.patch(
  '/student-requests/:id',
  authenticateProfessor,
  professorController.updateStudentRequest
);


module.exports = router;