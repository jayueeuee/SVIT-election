-- Development cleanup only. Does not drop the database.
-- Removes elections, positions, candidates, votes, and the optional development professor.
-- Keep real professor accounts unless you add them to the DELETE below.

BEGIN;

DELETE FROM votes;
DELETE FROM elections
WHERE election_code = 'DEMO26'
   OR election_name = 'Demo College Election 2026';
DELETE FROM elections;
DELETE FROM professors
WHERE email = 'professor.demo@college.edu';

COMMIT;
