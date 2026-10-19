-- Optional: apply to an existing college_election database created by the earlier demo schema.
-- Does NOT drop the database.
-- Review results before running on any database that already has real votes.

BEGIN;

DELETE FROM votes;
DELETE FROM elections
WHERE election_code = 'DEMO26'
   OR election_name = 'Demo College Election 2026'
   OR election_key = '123456';

ALTER TABLE elections
  ALTER COLUMN election_key TYPE VARCHAR(512);

ALTER TABLE elections
  ADD COLUMN IF NOT EXISTS election_key_hash VARCHAR(255);

ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS email_normalized VARCHAR(255);

ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS roll_no_normalized VARCHAR(100);

UPDATE votes
SET email_normalized = LOWER(TRIM(email))
WHERE email_normalized IS NULL;

UPDATE votes
SET roll_no_normalized = UPPER(regexp_replace(TRIM(roll_no), '\s+', '', 'g'))
WHERE roll_no_normalized IS NULL;

ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS votes_unique_student_per_election;

ALTER TABLE votes
  ALTER COLUMN email_normalized SET NOT NULL;

ALTER TABLE votes
  ALTER COLUMN roll_no_normalized SET NOT NULL;

ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS votes_unique_email_per_election;

ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS votes_unique_roll_per_election;

ALTER TABLE votes
  ADD CONSTRAINT votes_unique_email_per_election UNIQUE (election_id, email_normalized);

ALTER TABLE votes
  ADD CONSTRAINT votes_unique_roll_per_election UNIQUE (election_id, roll_no_normalized);

CREATE INDEX IF NOT EXISTS idx_votes_email_normalized ON votes (email_normalized);
CREATE INDEX IF NOT EXISTS idx_votes_roll_normalized ON votes (roll_no_normalized);

COMMIT;
