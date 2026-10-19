const jwt = require('jsonwebtoken');
const db = require('../db');

const {
  computeStatus,
  isValidEmail,
  requiredString,
  publicElection,
} = require('./helpers');

const {
  verifyElectionKey,
  normalizeEmail,
  normalizeRoll,
} = require('../electionKey');


/*
=========================================================
ALLOWED STUDENT YEARS
=========================================================
*/

const ALLOWED_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
];


/*
=========================================================
YEAR -> DATABASE LIMIT COLUMN
=========================================================
*/

const YEAR_LIMIT_COLUMNS = {
  '1st Year': 'first_year_limit',
  '2nd Year': 'second_year_limit',
  '3rd Year': 'third_year_limit',
  '4th Year': 'fourth_year_limit',
};


/*
=========================================================
GET YEAR LIMIT
=========================================================
*/

function getYearLimit(election, studentYear) {
  const column = YEAR_LIMIT_COLUMNS[studentYear];

  if (!column) {
    return null;
  }

  const value = election[column];

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const limit = Number(value);

  if (!Number.isFinite(limit)) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(limit)
  );
}


/*
=========================================================
GET CURRENT VOTE COUNT FOR A YEAR
=========================================================
*/

async function getYearVoteCount(
  client,
  electionId,
  studentYear
) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS vote_count
     FROM votes
     WHERE election_id = $1
     AND student_year = $2`,
    [
      electionId,
      studentYear,
    ]
  );

  return Number(
    result.rows[0]?.vote_count || 0
  );
}


/*
=========================================================
CHECK YEAR VOTING CAPACITY
=========================================================
*/

async function checkYearCapacity(
  client,
  election,
  studentYear
) {
  const limit = getYearLimit(
    election,
    studentYear
  );

  if (limit === null) {
    return {
      allowed: true,
      limit: null,
      current: 0,
    };
  }

  const current = await getYearVoteCount(
    client,
    election.id,
    studentYear
  );

  return {
    allowed: current < limit,
    limit,
    current,
  };
}


/*
=========================================================
BUILD BALLOT
=========================================================
*/

async function getElectionBallot(
  client,
  electionId
) {
  const ballotResult = await client.query(
    `SELECT
       p.id AS position_id,
       p.position_name,
       c.id AS candidate_id,
       c.candidate_name,
       c.branch,
       c.year,
       c.manifesto
     FROM positions p
     LEFT JOIN candidates c
       ON c.position_id = p.id
     WHERE p.election_id = $1
     ORDER BY p.id, c.id`,
    [electionId]
  );

  const positionsMap = new Map();

  for (const row of ballotResult.rows) {

    if (!positionsMap.has(row.position_id)) {
      positionsMap.set(
        row.position_id,
        {
          id: row.position_id,
          position_name: row.position_name,
          candidates: [],
        }
      );
    }

    if (row.candidate_id) {
      positionsMap
        .get(row.position_id)
        .candidates
        .push({
          id: row.candidate_id,
          candidate_name: row.candidate_name,
          branch: row.branch,
          year: row.year,
          manifesto: row.manifesto,
        });
    }
  }

  return Array.from(
    positionsMap.values()
  );
}


/*
=========================================================
CHECK PROFESSOR APPROVAL
=========================================================
*/
async function checkStudentApproval(
  client,
  electionId,
  email,
  rollNo
) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedRoll = normalizeRoll(rollNo);

  const result = await client.query(
    `SELECT
       id,
       status
     FROM student_requests
     WHERE election_id = $1
       AND LOWER(TRIM(email)) = $2
       AND UPPER(
         REGEXP_REPLACE(
           TRIM(roll_no),
           '\\s+',
           '',
           'g'
         )
       ) = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [
      electionId,
      normalizedEmail,
      normalizedRoll,
    ]
  );

  return result.rows[0] || null;
}
/*
=========================================================
STUDENT LOGIN / VERIFICATION
=========================================================
*/

async function studentLogin(
  req,
  res
) {
  const code =
    requiredString(
      req.params.electionCode,
      32
    );

  const studentName =
    requiredString(
      req.body.student_name,
      255
    );

  const rollNo =
    requiredString(
      req.body.roll_no,
      100
    );

  const branch =
    requiredString(
      req.body.branch,
      255
    );

  const studentYear =
    requiredString(
      req.body.year,
      20
    );

  const email =
    normalizeEmail(
      req.body.email
    );

  const electionKey =
    String(
      req.body.election_key || ''
    ).trim();


  /*
  -------------------------------------------------------
  REQUIRED FIELDS
  -------------------------------------------------------
  */

  if (
    !code ||
    !studentName ||
    !rollNo ||
    !branch ||
    !studentYear ||
    !email ||
    !electionKey
  ) {
    return res.status(400).json({
      error:
        'Please fill in all required fields.',
    });
  }


  /*
  -------------------------------------------------------
  VALIDATE YEAR
  -------------------------------------------------------
  */

  if (
    !ALLOWED_YEARS.includes(
      studentYear
    )
  ) {
    return res.status(400).json({
      error:
        'Please select a valid year.',
    });
  }


  /*
  -------------------------------------------------------
  VALIDATE EMAIL
  -------------------------------------------------------
  */

  if (
    !isValidEmail(email)
  ) {
    return res.status(400).json({
      error:
        'Please enter a valid email address.',
    });
  }


  try {

    /*
    -----------------------------------------------------
    FIND ELECTION
    -----------------------------------------------------
    */

    const electionResult =
      await db.query(
        `SELECT *
         FROM elections
         WHERE election_code = $1`,
        [
          code.toUpperCase(),
        ]
      );

    const election =
      electionResult.rows[0];

    if (!election) {
      return res.status(404).json({
        error:
          'Election not found.',
      });
    }


    /*
    -----------------------------------------------------
    VERIFY ELECTION KEY
    -----------------------------------------------------
    */

    const validKey =
      await verifyElectionKey(
        electionKey,
        election.election_key_hash
      );

    if (!validKey) {
      return res.status(401).json({
        error:
          'Invalid election key.',
      });
    }


    /*
    -----------------------------------------------------
    CHECK PROFESSOR APPROVAL
    -----------------------------------------------------
    */
let studentRequest =
  await checkStudentApproval(
    db,
    election.id,
    email,
    rollNo
  );
if (!studentRequest) {

  const requestResult =
    await db.query(
      `INSERT INTO student_requests
       (
         election_id,
         name,
         roll_no,
         email,
         status
       )
       VALUES
       (
         $1,
         $2,
         $3,
         $4,
         'Pending'
       )
       RETURNING
         id,
         election_id,
         status`,
      [
        election.id,
        studentName,
        rollNo,
        email,
      ]
    );

  studentRequest =
    requestResult.rows[0];

  return res.status(403).json({
    error:
      'Your request has been sent to the professor and is pending approval.',
  });
}
if (
  studentRequest.status === 'Pending'
) {
  return res.status(403).json({
    error:
      'Your request is still pending professor approval.',
  });
}

if (
  studentRequest.status === 'Rejected'
) {
  return res.status(403).json({
    error:
      'Your student request has been rejected by the professor.',
  });
}

if (
  studentRequest.status !== 'Approved'
) {
  return res.status(403).json({
    error:
      'Your request has not been approved by the professor yet.',
  });
}

    /*
    -----------------------------------------------------
    CHECK ELECTION STATUS
    -----------------------------------------------------
    */

    const status =
      computeStatus(
        election.start_time,
        election.end_time
      );

    if (
      status !== 'Active'
    ) {
      return res.status(403).json({
        error:
          status === 'Scheduled'
            ? 'Voting has not started yet.'
            : 'Voting is not currently active.',
      });
    }


    /*
    -----------------------------------------------------
    NORMALIZE ROLL NUMBER
    -----------------------------------------------------
    */

    const normalizedRoll =
      normalizeRoll(
        rollNo
      );


    /*
    -----------------------------------------------------
    CHECK DUPLICATE EMAIL + YEAR
    -----------------------------------------------------
    */

    const existingEmailVote =
      await db.query(
        `SELECT id
         FROM votes
         WHERE election_id = $1
         AND email_normalized = $2
         AND student_year = $3`,
        [
          election.id,
          email,
          studentYear,
        ]
      );

    if (
      existingEmailVote.rowCount > 0
    ) {
      return res.status(409).json({
        error:
          'You have already submitted your vote for this election and year.',
      });
    }


    /*
    -----------------------------------------------------
    CHECK DUPLICATE ROLL + YEAR
    -----------------------------------------------------
    */

    const existingRollVote =
      await db.query(
        `SELECT id
         FROM votes
         WHERE election_id = $1
         AND roll_no_normalized = $2
         AND student_year = $3`,
        [
          election.id,
          normalizedRoll,
          studentYear,
        ]
      );

    if (
      existingRollVote.rowCount > 0
    ) {
      return res.status(409).json({
        error:
          'This roll number has already been used to vote for this year.',
      });
    }


    /*
    -----------------------------------------------------
    CHECK YEAR CAPACITY
    -----------------------------------------------------
    */

    const capacity =
      await checkYearCapacity(
        db,
        election,
        studentYear
      );

    if (
      !capacity.allowed
    ) {
      return res.status(409).json({
        error:
          `Voting capacity for ${studentYear} is full. ` +
          `Maximum allowed voters: ${capacity.limit}.`,
      });
    }


    /*
    -----------------------------------------------------
    GET BALLOT
    -----------------------------------------------------
    */

    const positions =
      await getElectionBallot(
        db,
        election.id
      );

    const totalCandidates =
      positions.reduce(
        (total, position) =>
          total +
          position.candidates.length,
        0
      );

    if (
      totalCandidates === 0
    ) {
      return res.status(400).json({
        error:
          'No candidates are available for this election.',
      });
    }


    /*
    -----------------------------------------------------
    CREATE STUDENT JWT
    -----------------------------------------------------
    */

    const token =
      jwt.sign(
        {
          role: 'student',
          electionId: election.id,
          electionCode:
            election.election_code,
          email,
          studentName,
          rollNo,
          normalizedRoll,
          branch,
          year: studentYear,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '2h',
        }
      );


    /*
    -----------------------------------------------------
    SEND RESPONSE
    -----------------------------------------------------
    */

    return res.json({
      token,

      election:
        publicElection(
          election
        ),

      positions,
    });

  } catch (error) {

    console.error(
      'Student login error:',
      error
    );

    return res.status(500).json({
      error:
        'Something went wrong. Please try again.',
    });
  }
}


/*
=========================================================
SUBMIT VOTE
=========================================================
*/

async function submitVote(
  req,
  res
) {
  const code =
    requiredString(
      req.params.electionCode,
      32
    );

  const candidateId =
    Number(
      req.body.candidate_id
    );

  const electionKey =
    String(
      req.body.election_key || ''
    ).trim();


  /*
  -------------------------------------------------------
  REQUIRED FIELDS
  -------------------------------------------------------
  */

  if (
    !code ||
    !candidateId ||
    !electionKey
  ) {
    return res.status(400).json({
      error:
        'Please fill in all required fields.',
    });
  }


  /*
  -------------------------------------------------------
  STUDENT AUTHENTICATION
  -------------------------------------------------------
  */

  if (
    !req.student ||
    String(
      req.student.electionCode
    ).toUpperCase() !==
      code.toUpperCase()
  ) {
    return res.status(403).json({
      error:
        'Student verification does not match this election.',
    });
  }


  try {

    const vote =
      await db.withTransaction(
        async (client) => {

          /*
          ------------------------------------------------
          LOCK ELECTION ROW
          ------------------------------------------------
          */

          const electionResult =
            await client.query(
              `SELECT *
               FROM elections
               WHERE election_code = $1
               FOR UPDATE`,
              [
                code.toUpperCase(),
              ]
            );

          const election =
            electionResult.rows[0];

          if (!election) {
            const err =
              new Error(
                'Election not found.'
              );

            err.statusCode = 404;

            throw err;
          }


          /*
          ------------------------------------------------
          VERIFY ELECTION OWNERSHIP
          ------------------------------------------------
          */

          if (
            election.id !==
            req.student.electionId
          ) {
            const err =
              new Error(
                'Student verification does not match this election.'
              );

            err.statusCode = 403;

            throw err;
          }


          /*
          ------------------------------------------------
          VERIFY ELECTION KEY
          ------------------------------------------------
          */

          const validKey =
            await verifyElectionKey(
              electionKey,
              election.election_key_hash
            );

          if (!validKey) {
            const err =
              new Error(
                'Invalid election key.'
              );

            err.statusCode = 401;

            throw err;
          }


          /*
          ------------------------------------------------
          CHECK ELECTION STATUS
          ------------------------------------------------
          */

          const status =
            computeStatus(
              election.start_time,
              election.end_time
            );

          if (
            status !== 'Active'
          ) {
            const err =
              new Error(
                'Voting is not currently active.'
              );

            err.statusCode = 403;

            throw err;
          }


          /*
          ------------------------------------------------
          STUDENT INFORMATION
          ------------------------------------------------
          */

          const email =
            normalizeEmail(
              req.student.email
            );

          const normalizedRoll =
            normalizeRoll(
              req.student.rollNo
            );

          const studentYear =
            String(
              req.student.year || ''
            ).trim();


          /*
          ------------------------------------------------
          CHECK PROFESSOR APPROVAL AGAIN
          ------------------------------------------------

          This is important because the professor can
          change approval after student login.
          ------------------------------------------------
          */

       const studentRequest =
  await checkStudentApproval(
    client,
    election.id,
    email,
    req.student.rollNo
  );
          if (!studentRequest) {
            const err =
              new Error(
                'No student request found. Please contact the professor.'
              );

            err.statusCode = 403;

            throw err;
          }

          if (
            studentRequest.status === 'Pending'
          ) {
            const err =
              new Error(
                'Your student request is still pending professor approval.'
              );

            err.statusCode = 403;

            throw err;
          }

          if (
            studentRequest.status === 'Rejected'
          ) {
            const err =
              new Error(
                'Your student request has been rejected by the professor.'
              );

            err.statusCode = 403;

            throw err;
          }

          if (
            studentRequest.status !== 'Approved'
          ) {
            const err =
              new Error(
                'Your student request has not been approved by the professor.'
              );

            err.statusCode = 403;

            throw err;
          }


          /*
          ------------------------------------------------
          VALIDATE YEAR
          ------------------------------------------------
          */

          if (
            !ALLOWED_YEARS.includes(
              studentYear
            )
          ) {
            const err =
              new Error(
                'Invalid student year.'
              );

            err.statusCode = 400;

            throw err;
          }


          /*
          ------------------------------------------------
          VALIDATE CANDIDATE
          ------------------------------------------------
          */

          const candidateResult =
            await client.query(
              `SELECT
                 c.id,
                 c.candidate_name
               FROM candidates c
               JOIN positions p
                 ON p.id = c.position_id
               WHERE c.id = $1
               AND p.election_id = $2`,
              [
                candidateId,
                election.id,
              ]
            );

          if (
            !candidateResult.rows[0]
          ) {
            const err =
              new Error(
                'Invalid candidate selected.'
              );

            err.statusCode = 400;

            throw err;
          }


          /*
          ------------------------------------------------
          ONE VOTE PER EMAIL + YEAR
          ------------------------------------------------
          */

          const existingEmail =
            await client.query(
              `SELECT id
               FROM votes
               WHERE election_id = $1
               AND email_normalized = $2
               AND student_year = $3`,
              [
                election.id,
                email,
                studentYear,
              ]
            );

          if (
            existingEmail.rowCount > 0
          ) {
            const err =
              new Error(
                'You have already submitted your vote for this election and year.'
              );

            err.statusCode = 409;

            throw err;
          }


          /*
          ------------------------------------------------
          ONE VOTE PER ROLL NUMBER + YEAR
          ------------------------------------------------
          */

          const existingRoll =
            await client.query(
              `SELECT id
               FROM votes
               WHERE election_id = $1
               AND roll_no_normalized = $2
               AND student_year = $3`,
              [
                election.id,
                normalizedRoll,
                studentYear,
              ]
            );

          if (
            existingRoll.rowCount > 0
          ) {
            const err =
              new Error(
                'This roll number has already been used to vote for this year.'
              );

            err.statusCode = 409;

            throw err;
          }


          /*
          ------------------------------------------------
          CHECK YEAR CAPACITY
          ------------------------------------------------
          */

          const capacity =
            await checkYearCapacity(
              client,
              election,
              studentYear
            );

          if (
            !capacity.allowed
          ) {
            const err =
              new Error(
                `Voting capacity for ${studentYear} is full. ` +
                `Maximum allowed voters: ${capacity.limit}.`
              );

            err.statusCode = 409;

            throw err;
          }


          /*
          ------------------------------------------------
          INSERT VOTE
          ------------------------------------------------
          */

          const insert =
            await client.query(
              `INSERT INTO votes (
                 election_id,
                 candidate_id,
                 student_name,
                 roll_no,
                 roll_no_normalized,
                 branch,
                 email,
                 email_normalized,
                 student_year
               )
               VALUES (
                 $1,
                 $2,
                 $3,
                 $4,
                 $5,
                 $6,
                 $7,
                 $8,
                 $9
               )
               RETURNING id, voted_at`,
              [
                election.id,
                candidateId,
                req.student.studentName,
                req.student.rollNo,
                normalizedRoll,
                req.student.branch,
                email,
                email,
                studentYear,
              ]
            );


          return {
            vote:
              insert.rows[0],

            election,

            candidate:
              candidateResult.rows[0],
          };
        }
      );


    /*
    -----------------------------------------------------
    SUCCESS
    -----------------------------------------------------
    */

    return res.status(201).json({

      message:
        'Vote submitted successfully.',

      election_name:
        vote.election.election_name,

      candidate_name:
        vote.candidate.candidate_name,

      voted_at:
        vote.vote.voted_at,

    });

  } catch (error) {

    /*
    -----------------------------------------------------
    DUPLICATE DATABASE CONSTRAINT
    -----------------------------------------------------
    */

    if (
      error.code === '23505'
    ) {
      return res.status(409).json({
        error:
          'You have already submitted your vote for this election and year.',
      });
    }


    /*
    -----------------------------------------------------
    KNOWN APPLICATION ERROR
    -----------------------------------------------------
    */

    if (
      error.statusCode
    ) {
      return res.status(
        error.statusCode
      ).json({
        error:
          error.message,
      });
    }


    /*
    -----------------------------------------------------
    UNKNOWN ERROR
    -----------------------------------------------------
    */

    console.error(
      'Submit vote error:',
      error
    );

    return res.status(500).json({
      error:
        'Something went wrong. Please try again.',
    });
  }
}


/*
=========================================================
GET BALLOT
=========================================================
*/

async function getBallot(
  req,
  res
) {
  const code =
    requiredString(
      req.params.electionCode,
      32
    );

  if (
    !code ||
    !req.student ||
    String(
      req.student.electionCode
    ).toUpperCase() !==
      code.toUpperCase()
  ) {
    return res.status(403).json({
      error:
        'Student verification required.',
    });
  }


  try {

    /*
    -----------------------------------------------------
    GET ELECTION
    -----------------------------------------------------
    */

    const electionResult =
      await db.query(
        `SELECT *
         FROM elections
         WHERE election_code = $1`,
        [
          code.toUpperCase(),
        ]
      );

    const election =
      electionResult.rows[0];

    if (!election) {
      return res.status(404).json({
        error:
          'Election not found.',
      });
    }


    /*
    -----------------------------------------------------
    CHECK ACTIVE
    -----------------------------------------------------
    */

    const status =
      computeStatus(
        election.start_time,
        election.end_time
      );

    if (
      status !== 'Active'
    ) {
      return res.status(403).json({
        error:
          'Voting is not currently active.',
      });
    }


    /*
    -----------------------------------------------------
    STUDENT INFORMATION
    -----------------------------------------------------
    */

    const email =
      normalizeEmail(
        req.student.email
      );

    const normalizedRoll =
      normalizeRoll(
        req.student.rollNo
      );

    const studentYear =
      String(
        req.student.year || ''
      ).trim();


    /*
    -----------------------------------------------------
    CHECK PROFESSOR APPROVAL
    -----------------------------------------------------
    */
   
/*
=========================================================
CHECK / CREATE STUDENT REQUEST
=========================================================
*/
let studentRequest =
  await checkStudentApproval(
    db,
    election.id,
    email,
    req.student.rollNo
  );

/*
---------------------------------------------------------
NO REQUEST -> CREATE PENDING REQUEST
---------------------------------------------------------
*/
if (!studentRequest) {
  const requestResult = await db.query(
    `INSERT INTO student_requests
      (
        election_id,
        name,
        roll_no,
        email,
        status
      )
     VALUES
      (
        $1,
        $2,
        $3,
        $4,
        'Pending'
      )
     RETURNING
       id,
       election_id,
       status`,
    [
      election.id,
      req.student.studentName,
      req.student.rollNo,
      email
    ]
  );

  studentRequest = requestResult.rows[0];

  return res.status(403).json({
    error:
      'Your request has been sent to the professor and is pending approval.',
  });
}


/*
---------------------------------------------------------
PENDING
---------------------------------------------------------
*/

if (
  studentRequest.status === 'Pending'
) {

  return res.status(403).json({
    error:
      'Your request has been sent to the professor and is pending approval.',
  });
}


/*
---------------------------------------------------------
REJECTED
---------------------------------------------------------
*/

if (
  studentRequest.status === 'Rejected'
) {

  return res.status(403).json({
    error:
      'Your student request has been rejected by the professor.',
  });
}


/*
---------------------------------------------------------
APPROVED
---------------------------------------------------------
*/

if (
  studentRequest.status !== 'Approved'
) {

  return res.status(403).json({
    error:
      'Your request has not been approved by the professor yet.',
  });
}
    /*
    -----------------------------------------------------
    VALIDATE YEAR
    -----------------------------------------------------
    */

    if (
      !ALLOWED_YEARS.includes(
        studentYear
      )
    ) {
      return res.status(400).json({
        error:
          'Invalid student year.',
      });
    }


    /*
    -----------------------------------------------------
    CHECK PREVIOUS VOTE
    -----------------------------------------------------
    */

    const existingVote =
      await db.query(
        `SELECT id
         FROM votes
         WHERE election_id = $1
         AND (
           (
             roll_no_normalized = $2
             AND student_year = $3
           )
           OR
           (
             email_normalized = $4
             AND student_year = $3
           )
         )`,
        [
          election.id,
          normalizedRoll,
          studentYear,
          email,
        ]
      );

    if (
      existingVote.rowCount > 0
    ) {
      return res.status(409).json({
        error:
          'You have already submitted your vote for this election and year.',
      });
    }


    /*
    -----------------------------------------------------
    CHECK YEAR CAPACITY
    -----------------------------------------------------
    */

    const capacity =
      await checkYearCapacity(
        db,
        election,
        studentYear
      );

    if (
      !capacity.allowed
    ) {
      return res.status(409).json({
        error:
          `Voting capacity for ${studentYear} is full. ` +
          `Maximum allowed voters: ${capacity.limit}.`,
      });
    }


    /*
    -----------------------------------------------------
    GET BALLOT
    -----------------------------------------------------
    */

    const positions =
      await getElectionBallot(
        db,
        election.id
      );


    /*
    -----------------------------------------------------
    SEND BALLOT
    -----------------------------------------------------
    */

    return res.json({

      election:
        publicElection(
          election
        ),

      student: {

        student_name:
          req.student.studentName,

        roll_no:
          req.student.rollNo,

        branch:
          req.student.branch,

        year:
          studentYear,

        email:
          email,

      },

      positions,

    });

  } catch (error) {

    console.error(
      'Get ballot error:',
      error
    );

    return res.status(500).json({
      error:
        'Something went wrong. Please try again.',
    });
  }
}


/*
=========================================================
EXPORT
=========================================================
*/

module.exports = {

  studentLogin,

  submitVote,

  getBallot,

};