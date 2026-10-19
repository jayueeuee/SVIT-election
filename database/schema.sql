-- ====================================================================
-- College Election Management System - Database Schema
-- All tables, constraints, columns, and indexes used by the application
-- ====================================================================

-- 1. PROFESSORS (Faculty / Election Administrators)
CREATE TABLE IF NOT EXISTS professors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ELECTIONS (Election configurations and timelines)
CREATE TABLE IF NOT EXISTS elections (
  id SERIAL PRIMARY KEY,
  election_code VARCHAR(32) NOT NULL UNIQUE,
  election_name VARCHAR(255) NOT NULL,
  description TEXT,
  election_key VARCHAR(512) NOT NULL,
  election_key_hash VARCHAR(255) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Scheduled',
  expected_voters INTEGER,
  first_year_limit INTEGER DEFAULT 0,
  second_year_limit INTEGER DEFAULT 0,
  third_year_limit INTEGER DEFAULT 0,
  fourth_year_limit INTEGER DEFAULT 0,
  is_priority BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  professor_id INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT elections_time_check CHECK (end_time > start_time),
  CONSTRAINT elections_expected_voters_check CHECK (
    expected_voters IS NULL OR expected_voters >= 0
  )
);

-- Idempotent column migrations for elections (if table pre-existed)
ALTER TABLE elections ADD COLUMN IF NOT EXISTS first_year_limit INTEGER DEFAULT 0;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS second_year_limit INTEGER DEFAULT 0;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS third_year_limit INTEGER DEFAULT 0;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS fourth_year_limit INTEGER DEFAULT 0;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- 3. STUDENTS (Student accounts for student authentication)
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  roll_no VARCHAR(100) NOT NULL,
  branch VARCHAR(255) NOT NULL,
  student_year VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. STUDENT REQUESTS (Approval requests submitted by students to professors)
CREATE TABLE IF NOT EXISTS student_requests (
  id SERIAL PRIMARY KEY,
  election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  roll_no VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_requests_status_check
    CHECK (
      status IN ('Pending', 'Approved', 'Rejected')
    )
);

-- Ensure election_id is nullable for general student registrations
ALTER TABLE student_requests ALTER COLUMN election_id DROP NOT NULL;

-- 5. POSITIONS (Posts being contested under an election)
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  position_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CANDIDATES (Nominees running for each position)
CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  candidate_name VARCHAR(255) NOT NULL,
  branch VARCHAR(255),
  year VARCHAR(50),
  manifesto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. VOTES (Ballots cast by verified students)
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  student_name VARCHAR(255) NOT NULL,
  roll_no VARCHAR(100) NOT NULL,
  roll_no_normalized VARCHAR(100) NOT NULL,
  branch VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  email_normalized VARCHAR(255) NOT NULL,
  student_year VARCHAR(50),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT votes_unique_email_per_election UNIQUE (election_id, email_normalized),
  CONSTRAINT votes_unique_roll_per_election UNIQUE (election_id, roll_no_normalized)
);

-- Idempotent column migration for votes (if table pre-existed)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS student_year VARCHAR(50);

-- ====================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_professors_email ON professors (email);

CREATE INDEX IF NOT EXISTS idx_students_email ON students (email);
CREATE INDEX IF NOT EXISTS idx_students_roll_no ON students (roll_no);

CREATE INDEX IF NOT EXISTS idx_elections_professor_id ON elections (professor_id);
CREATE INDEX IF NOT EXISTS idx_elections_code ON elections (election_code);

CREATE INDEX IF NOT EXISTS idx_student_requests_election_id ON student_requests (election_id);
CREATE INDEX IF NOT EXISTS idx_student_requests_status ON student_requests (status);
CREATE INDEX IF NOT EXISTS idx_student_requests_email ON student_requests (email);

CREATE INDEX IF NOT EXISTS idx_positions_election_id ON positions (election_id);

CREATE INDEX IF NOT EXISTS idx_candidates_position_id ON candidates (position_id);

CREATE INDEX IF NOT EXISTS idx_votes_election_id ON votes (election_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON votes (candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_email ON votes (email);
CREATE INDEX IF NOT EXISTS idx_votes_email_normalized ON votes (email_normalized);
CREATE INDEX IF NOT EXISTS idx_votes_roll_normalized ON votes (roll_no_normalized);
CREATE INDEX IF NOT EXISTS idx_votes_student_year ON votes (student_year);
