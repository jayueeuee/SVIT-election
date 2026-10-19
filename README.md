# College Election Management System

A working full-stack campus election application: professors create elections, students vote once, and live counts are stored in PostgreSQL.

## 1. Project overview

The system supports a real college election flow rather than a static demo. Professors authenticate with JWT, create elections with positions and candidates, then share a unique link and a securely generated numeric key. Students open the link, enter their details and the key, choose **exactly one candidate**, confirm, and submit. Duplicate votes are blocked in the API and by a database unique constraint.

## 2. Features

- Professor login with hashed passwords
- Election creation with start/end times
- Multiple positions and candidates
- Unique election code, shareable link, and numeric election key
- Student verification without a pre-created student roster
- One vote per student per election (`UNIQUE(election_id, email)`)
- Live professor dashboard (polls every 2.5 seconds)
- Automatic status: Scheduled, Active, Completed
- Rate limiting on login and voting endpoints

## 3. Technology stack

- Frontend: HTML5, CSS3, vanilla JavaScript
- Backend: Node.js, Express.js
- Database: PostgreSQL
- Libraries: `pg`, `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit`

## 4. Folder structure

```
college-election/
├── frontend/
├── backend/
├── database/schema.sql
├── scripts/concurrent-vote-test.js
├── .env.example
├── package.json
└── README.md
```

## 5. PostgreSQL installation

Install PostgreSQL for your operating system, then confirm `psql` is available.

Windows (example): install from the official PostgreSQL installer and add `psql` to PATH.

## 6. Database creation

```sql
CREATE DATABASE college_election;
```

## 7. How to run schema.sql

From the project root, after replacing the connection details:

```bash
psql "postgresql://username:password@localhost:5432/college_election" -f database/schema.sql
```

PowerShell:

```powershell
psql "postgresql://username:password@localhost:5432/college_election" -f database/schema.sql
```

## 8. Environment variables

Copy the example file and edit it. Do not commit a real `.env`.

```bash
copy .env.example .env
```

Required values:

- `PORT` — default `3000`
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — a long random secret for professor and student tokens

## 9. npm install

```bash
npm install
```

## 10. How to start backend

```bash
npm run seed
npm start
```

`npm run seed` creates the **DEMO DATA** professor and a sample election. `npm start` serves the API and the frontend on the same port.

## 11. How to open frontend

Open:

```
http://localhost:3000
```

The Express server serves `frontend/` as static files. Election links look like:

```
http://localhost:3000/election/ABC123
```

## 12. Demo professor login

This is **DEMO DATA**. Do not use real student personal information.

- Email: `professor.demo@college.edu`
- Password: `DemoProf@123`

Seeded demo election (if created by `npm run seed`):

- Name: Demo College Election 2026
- Position: Class Representative
- Candidates: Candidate A, Candidate B, Candidate C
- Code: `DEMO26`
- Key: `123456` (demo only; real elections generate a random key)

## 13. How to create an election

1. Sign in as professor.
2. Open **Create election**.
3. Enter name, description, start time, end time, optional expected voters.
4. Add positions and candidates.
5. Submit. Copy the generated **Election Link** and **Election Key**.

## 14. How students vote

1. Open the election link.
2. Confirm the election is **Active**.
3. Enter full name, roll number, branch, email, and election key.
4. Select **exactly one** candidate.
5. Confirm the vote.
6. See the success page. A second attempt with the same email is rejected.

## 15. How live counting works

The professor dashboard calls `GET /api/elections/:electionId/results` every 2.5 seconds. Counts come from PostgreSQL `COUNT(*)` grouped by candidate. Individual student choices are never shown.

## 16. Testing instructions

See the checklist below. Concurrent votes:

```bash
npm run test:concurrent -- DEMO26 123456 1
```

Replace the candidate id with a real id from the dashboard/API. The script sends two simultaneous votes for the same demo email. Expected result: one `201` and one `409`.

### Testing checklist

1. Professor login — valid demo credentials succeed; wrong password fails.
2. Election creation — new election returns code, link, and key.
3. Position creation — add a position from the dashboard.
4. Candidate creation — add a candidate under that position.
5. Election link generation — link opens `/election/{code}`.
6. Election key generation — key is numeric and copyable; not hard-coded for new elections.
7. Student login — complete form with correct key while Active.
8. Wrong key — `Invalid election key.`
9. Missing fields — `Please fill in all required fields.`
10. Voting — confirmed vote is stored and success page appears.
11. Duplicate voting — same email is rejected.
12. Invalid candidate — unknown candidate id returns `Invalid candidate selected.`
13. Election before start — status Scheduled; students cannot vote.
14. Election after end — status Completed; students cannot vote.
15. Live dashboard count — vote from a student and watch the table increment without refresh.
16. Concurrent submissions — run `scripts/concurrent-vote-test.js`.

## 17. Security considerations

- Professor passwords are hashed with bcrypt.
- JWT authenticates professors and verified students.
- SQL uses parameterized queries.
- CORS is enabled; credentials stay on the server.
- Rate limits apply to login and vote routes.
- Election keys are generated with `crypto.randomInt`.
- Database credentials are only in `.env`, never in frontend JS.
- Vote inserts run in a PostgreSQL transaction. Unique `(election_id, email)` still blocks races.

## 18. Deployment considerations

- Use HTTPS in production.
- Set a strong `JWT_SECRET`.
- Restrict CORS to your real origin.
- Back up PostgreSQL.
- Put Node behind a reverse proxy.
- Rotate demo accounts before any real election.

## Exact commands to run

```bash
cd college-election
copy .env.example .env
# edit .env with real DATABASE_URL and JWT_SECRET
psql "postgresql://username:password@localhost:5432/college_election" -f database/schema.sql
npm install
npm run seed
npm start
```

Then open `http://localhost:3000`.

## API endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/professor/login` | No | Professor login |
| GET | `/api/professor/me` | Professor JWT | Current professor |
| POST | `/api/elections` | Professor JWT | Create election |
| GET | `/api/elections` | Professor JWT | List elections |
| GET | `/api/elections/:electionCode` | Public | Election info |
| POST | `/api/elections/:electionId/positions` | Professor JWT | Add position |
| POST | `/api/positions/:positionId/candidates` | Professor JWT | Add candidate |
| POST | `/api/elections/:electionCode/student-login` | No | Verify student |
| GET | `/api/elections/:electionCode/ballot` | Student JWT | Ballot |
| POST | `/api/elections/:electionCode/vote` | Student JWT | Submit vote |
| GET | `/api/elections/:electionId/results` | Professor JWT | Live results |
| GET | `/api/elections/:electionId/stats` | Professor JWT | Same as results |

## Database tables

- **professors** — faculty accounts (`id`, `name`, `email`, `password_hash`, `created_at`)
- **elections** — election metadata, code, key, schedule, optional `expected_voters`
- **positions** — posts under an election
- **candidates** — people standing for a position
- **votes** — one row per student vote; unique on `(election_id, email)`

Status is also computed from `start_time` and `end_time` on every request so students cannot vote outside the window.
