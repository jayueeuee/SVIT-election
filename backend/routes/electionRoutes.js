const express = require('express');

const rateLimit = require('express-rate-limit');

const electionController = require('../controllers/electionController');

const votingController = require('../controllers/votingController');

const {
  authenticateProfessor,
  authenticateStudent
} = require('../middleware/auth');

const router = express.Router();


/*
=========================================================
STUDENT LOGIN RATE LIMIT
=========================================================
*/

const studentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many attempts. Please try again later.'
  },
});


/*
=========================================================
VOTE RATE LIMIT
=========================================================
*/

const voteLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 10,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error:
      'Too many voting attempts. Please try again later.'
  },

});


/*
=========================================================
PROFESSOR ELECTION ROUTES
=========================================================
*/


/*
CREATE ELECTION
*/

router.post(
  '/',
  authenticateProfessor,
  electionController.createElection
);


/*
LIST PROFESSOR ELECTIONS
*/

router.get(
  '/',
  authenticateProfessor,
  electionController.listElections
);


/*
GET ELECTION RESULTS
*/

router.get(
  '/:electionId/results',
  authenticateProfessor,
  electionController.getResults
);


/*
GET ELECTION STATS
*/

router.get(
  '/:electionId/stats',
  authenticateProfessor,
  electionController.getStats
);


/*
ADD POSITION
*/

router.post(
  '/:electionId/positions',
  authenticateProfessor,
  electionController.addPosition
);


/*
=========================================================
PRIORITY
=========================================================
*/

router.patch(
  '/:electionId/priority',
  authenticateProfessor,
  electionController.togglePriority
);


/*
=========================================================
ARCHIVE
=========================================================
*/

router.patch(
  '/:electionId/archive',
  authenticateProfessor,
  electionController.archiveElection
);


/*
=========================================================
STUDENT ROUTES
=========================================================
*/


/*
STUDENT LOGIN
*/

router.post(
  '/:electionCode/student-login',
  studentLimiter,
  votingController.studentLogin
);


/*
GET BALLOT
*/

router.get(
  '/:electionCode/ballot',
  authenticateStudent,
  votingController.getBallot
);


/*
SUBMIT VOTE
*/

router.post(
  '/:electionCode/vote',
  voteLimiter,
  authenticateStudent,
  votingController.submitVote
);

router.get(
  '/:electionCode/live-results',
  electionController.getPublicLiveResults
);
/*
PUBLIC ELECTION
*/

router.get(
  '/:electionCode',
  electionController.getPublicElection
);


module.exports = router;