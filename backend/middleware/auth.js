const jwt = require('jsonwebtoken');

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

function authenticateProfessor(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'professor') {
      return res.status(403).json({ error: 'Professor access required.' });
    }
    req.professor = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

function authenticateStudent(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Student verification required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'student') {
      return res.status(403).json({ error: 'Student access required.' });
    }
    req.student = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Your session expired. Please verify again.' });
  }
}

module.exports = {
  authenticateProfessor,
  authenticateStudent,
};
