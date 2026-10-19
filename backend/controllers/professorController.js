const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { isValidEmail } = require('./helpers');

async function signup(req, res) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !isValidEmail(email) || !password) {
    return res.status(400).json({
      error: 'Please fill in all required fields.'
    });
  }

  if (name.length < 2) {
    return res.status(400).json({
      error: 'Please enter a valid name.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long.'
    });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM professors WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'An account with this email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO professors
        (name, email, password_hash)
       VALUES ($1, $2, $3)`,
      [name, email, passwordHash]
    );

    return res.status(201).json({
      message: 'Account created successfully.'
    });

  } catch (error) {
    console.error('Professor signup error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'An account with this email already exists.'
      });
    }

    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }
}


async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({
      error: 'Please fill in all required fields.'
    });
  }

  try {
    const result = await db.query(
      `SELECT
        id,
        name,
        email,
        password_hash
       FROM professors
       WHERE email = $1`,
      [email]
    );

    const professor = result.rows[0];

    if (!professor) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const match = await bcrypt.compare(
      password,
      professor.password_hash
    );

    if (!match) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      {
        role: 'professor',
        id: professor.id,
        name: professor.name,
        email: professor.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      professor: {
        id: professor.id,
        name: professor.name,
        email: professor.email,
      },
    });

  } catch (error) {
    console.error('Professor login error:', error);

    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }
}


async function me(req, res) {
  try {
    const result = await db.query(
      `SELECT
        id,
        name,
        email,
        created_at
       FROM professors
       WHERE id = $1`,
      [req.professor.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        error: 'Professor not found.'
      });
    }

    return res.json({
      professor: result.rows[0]
    });

  } catch (error) {
    console.error('Professor profile error:', error);

    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }
}


/* =========================================================
   STUDENT REQUESTS
   ========================================================= */

/*
---------------------------------------------------------
GET STUDENT REQUESTS

Only requests belonging to elections created by
the currently logged-in professor are returned.
---------------------------------------------------------
*/

async function getStudentRequests(req, res) {
  try {
    const professorId = Number(req.professor.id);

    if (!Number.isInteger(professorId) || professorId <= 0) {
      return res.status(401).json({
        error: 'Invalid professor session.'
      });
    }

    const result = await db.query(
      `SELECT
        sr.id,
        sr.election_id,
        e.election_name,
        e.election_code,
        sr.name,
        sr.roll_no,
        sr.email,
        sr.status,
        sr.created_at
       FROM student_requests sr
       INNER JOIN elections e
         ON e.id = sr.election_id
       WHERE e.professor_id = $1
       ORDER BY sr.created_at DESC`,
      [professorId]
    );

    return res.json({
      requests: result.rows
    });

  } catch (error) {
    console.error('Get student requests error:', error);

    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }
}


/*
---------------------------------------------------------
UPDATE STUDENT REQUEST

Only the professor who owns the election can
approve/reject its student request.
---------------------------------------------------------
*/

async function updateStudentRequest(req, res) {
  const requestId = Number(req.params.id);
  const status = String(req.body.status || '').trim();
  const professorId = Number(req.professor.id);

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({
      error: 'Invalid request ID.'
    });
  }

  if (!Number.isInteger(professorId) || professorId <= 0) {
    return res.status(401).json({
      error: 'Invalid professor session.'
    });
  }

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({
      error: 'Status must be Approved or Rejected.'
    });
  }

  try {
    const result = await db.query(
      `UPDATE student_requests sr
       SET status = $1
       FROM elections e
       WHERE sr.id = $2
         AND sr.election_id = e.id
         AND e.professor_id = $3
       RETURNING
         sr.id,
         sr.election_id,
         e.election_name,
         e.election_code,
         sr.name,
         sr.roll_no,
         sr.email,
         sr.status,
         sr.created_at`,
      [
        status,
        requestId,
        professorId
      ]
    );

    /*
    -------------------------------------------------------
    Request does not exist OR does not belong to this
    professor.
    -------------------------------------------------------
    */

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Student request not found.'
      });
    }

    return res.json({
      message:
        `Student request ${status.toLowerCase()} successfully.`,
      request: result.rows[0]
    });

  } catch (error) {
    console.error(
      'Update student request error:',
      error
    );

    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }
}


module.exports = {
  signup,
  login,
  me,
  getStudentRequests,
  updateStudentRequest
};