require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const professorRoutes = require('./routes/professorRoutes');
const electionRoutes = require('./routes/electionRoutes');
const votingRoutes = require('./routes/votingRoutes');
const studentRoutes = require('./routes/studentRoutes');
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is not set.');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const frontendDir = path.join(__dirname, '..', 'frontend');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(frontendDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/professor', professorRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/positions', votingRoutes);
app.use('/api/student', studentRoutes);
app.get('/election/:code', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'election.html'));
});

app.get('/voting/:code', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'voting.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  return next();
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`College Election server running at http://localhost:${PORT}`);
});
