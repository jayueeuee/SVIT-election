/**
 * Concurrent vote test
 *
 * Usage:
 *   node scripts/concurrent-vote-test.js <electionCode> <electionKey> <candidateId>
 *
 * The election must be Active. This script submits two votes at the same time
 * for the same student email. Exactly one insert should succeed because of
 * UNIQUE(election_id, email).
 */

const API = process.env.API_BASE || 'http://localhost:3000';

async function studentLogin(code, key, email) {
  const response = await fetch(`${API}/api/elections/${code}/student-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_name: 'Concurrent Test Student',
      roll_no: 'CT-001',
      branch: 'Computer Science',
      email,
      election_key: key,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Student login failed');
  }
  return data.token;
}

async function vote(code, token, candidateId) {
  const response = await fetch(`${API}/api/elections/${code}/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ candidate_id: Number(candidateId), election_key: key }),
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function main() {
  const [code, key, candidateId] = process.argv.slice(2);
  if (!code || !key || !candidateId) {
    console.error('Usage: node scripts/concurrent-vote-test.js <electionCode> <electionKey> <candidateId>');
    process.exit(1);
  }

  const email = `concurrent.${Date.now()}@demo.college.edu`;
  const token = await studentLogin(code, key, email);

  const [first, second] = await Promise.all([
    vote(code, token, candidateId),
    vote(code, token, candidateId),
  ]);

  console.log('Request A:', first.status, first.data);
  console.log('Request B:', second.status, second.data);

  const statuses = [first.status, second.status].sort();
  if (statuses[0] === 201 && statuses[1] === 409) {
    console.log('PASS: one vote stored, duplicate blocked.');
  } else {
    console.log('CHECK: expected one 201 and one 409.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
