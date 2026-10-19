const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { isValidEmail } = require('./helpers');


async function signup(req, res) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const rollNo = String(req.body.roll_no || '').trim();
  const branch = String(req.body.branch || '').trim();
  const studentYear = String(req.body.student_year || '').trim();

  if (
    !name ||
    !isValidEmail(email) ||
    !password ||
    !rollNo ||
    !branch ||
    !studentYear
  ) {
    return res.status(400).json({
      error: 'Please fill in all required fields.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long.'
    });
  }

  const allowedYears = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year'
  ];

  if (!allowedYears.includes(studentYear)) {
    return res.status(400).json({
      error: 'Please select a valid year.'
    });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM students WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'An account with this email already exists.'
      });
    }

    const existingRequest = await db.query(
      `SELECT id
       FROM student_requests
       WHERE LOWER(TRIM(email)) = $1
       LIMIT 1`,
      [email]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(409).json({
        error: 'A student request with this email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.withTransaction(async (client) => {

      // Create student account
      await client.query(
        `INSERT INTO students
          (name, email, password_hash, roll_no, branch, student_year)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          name,
          email,
          passwordHash,
          rollNo,
          branch,
          studentYear
        ]
      );

      // Send request to professor
      await client.query(
        `INSERT INTO student_requests
          (name, roll_no, email, status)
         VALUES ($1, $2, $3, 'Pending')`,
        [
          name,
          rollNo,
          email
        ]
      );
    });

    return res.status(201).json({
      message:
        'Account created successfully. Your request has been sent to the professor for approval.'
    });

  } catch (error) {
    console.error('Student signup error:', error);

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
        password_hash,
        roll_no,
        branch,
        student_year
       FROM students
       WHERE email = $1`,
      [email]
    );

    const student = result.rows[0];

    if (!student) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const match = await bcrypt.compare(
      password,
      student.password_hash
    );

    if (!match) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }


    /*
    ==========================================
    CHECK PROFESSOR APPROVAL
    ==========================================
    */

    const approvalResult = await db.query(
      `SELECT status
       FROM student_requests
       WHERE LOWER(TRIM(email)) = $1
         AND UPPER(
           REGEXP_REPLACE(
             TRIM(roll_no),
             '\\s+',
             '',
             'g'
           )
         ) = UPPER(
           REGEXP_REPLACE(
             TRIM($2),
             '\\s+',
             '',
             'g'
           )
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        email,
        student.roll_no
      ]
    );

    const request = approvalResult.rows[0];

    if (!request) {
      return res.status(403).json({
        error:
          'Your student request was not found. Please contact the professor.'
      });
    }

    if (request.status === 'Pending') {
      return res.status(403).json({
        error:
          'Your request is still pending professor approval.'
      });
    }

    if (request.status === 'Rejected') {
      return res.status(403).json({
        error:
          'Your student request has been rejected by the professor.'
      });
    }

    if (request.status !== 'Approved') {
      return res.status(403).json({
        error:
          'You are not approved to vote yet.'
      });
    }


    /*
    ==========================================
    CREATE STUDENT LOGIN TOKEN
    ==========================================
    */

    const token = jwt.sign(
      {
        role: 'student',
        id: student.id,
        name: student.name,
        email: student.email,
        rollNo: student.roll_no,
        branch: student.branch,
        studentYear: student.student_year
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        rollNo: student.roll_no,
        branch: student.branch,
        studentYear: student.student_year
      }
    });

  } catch (error) {
    console.error('Student login error:', error);

    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }
}


module.exports = {
  signup,
  login
};