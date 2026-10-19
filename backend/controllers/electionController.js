const crypto = require('crypto');
const db = require('../db');

const {
  computeStatus,
  requiredString,
  publicElection,
  professorElection,
} = require('./helpers');

const {
  generateElectionKey,
  protectElectionKey,
} = require('../electionKey');


/*
=========================================================
GENERATE ELECTION CODE
=========================================================
*/

function generateElectionCode() {

  return crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()
    .slice(0, 6);

}


/*
=========================================================
UNIQUE ELECTION CODE
=========================================================
*/

async function uniqueElectionCode(client) {

  const runner = client || db;

  for (
    let attempt = 0;
    attempt < 12;
    attempt += 1
  ) {

    const code =
      generateElectionCode();


    const existing =
      await runner.query(
        `
        SELECT id
        FROM elections
        WHERE election_code = $1
        `,
        [code]
      );


    if (existing.rowCount === 0) {

      return code;

    }

  }


  throw new Error(
    'Could not generate a unique election code.'
  );

}


/*
=========================================================
PARSE DATE
=========================================================
*/
function parseDate(value, label) {
  const text = String(value || '').trim();

  if (!text) {
    return {
      error: `${label} is invalid.`,
    };
  }

  /*
  -------------------------------------------------------
  TREAT datetime-local INPUT AS INDIA TIME (IST)
  -------------------------------------------------------

  The browser sends datetime-local like:

      2026-10-09T05:55

  It contains NO timezone.

  Render runs in UTC, so new Date(value) would
  incorrectly interpret 05:55 as UTC.

  We explicitly treat timezone-less values as IST (+05:30).
  -------------------------------------------------------
  */

  const hasTimezone =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);

  const date = new Date(
    hasTimezone
      ? text
      : `${text}+05:30`
  );

  if (Number.isNaN(date.getTime())) {
    return {
      error: `${label} is invalid.`,
    };
  }

  return {
    value: date.toISOString(),
  };
}

/*
=========================================================
CREATE ELECTION
=========================================================
*/

async function createElection(req, res) {

  const electionName =
    requiredString(
      req.body.election_name,
      255
    );


  const description =
    String(
      req.body.description || ''
    ).trim();


  const expectedVotersRaw =
    req.body.expected_voters;


  /*
  -------------------------------------------------------
  YEAR-WISE VOTING LIMITS
  -------------------------------------------------------
  */

  const yearLimits = {

    '1st Year':
      Number(
        req.body.first_year_limit
      ),

    '2nd Year':
      Number(
        req.body.second_year_limit
      ),

    '3rd Year':
      Number(
        req.body.third_year_limit
      ),

    '4th Year':
      Number(
        req.body.fourth_year_limit
      ),

  };


  /*
  -------------------------------------------------------
  VALIDATE YEAR-WISE LIMITS
  -------------------------------------------------------
  */

  for (
    const [year, limit]
    of Object.entries(yearLimits)
  ) {

    if (
      !Number.isInteger(limit) ||
      limit < 0
    ) {

      return res.status(400).json({

        error:
          `${year} limit must be a whole number greater than or equal to 0.`,

      });

    }

  }


  /*
  -------------------------------------------------------
  PARSE DATES
  -------------------------------------------------------
  */

  const start =
    parseDate(
      req.body.start_time,
      'Start time'
    );


  const end =
    parseDate(
      req.body.end_time,
      'End time'
    );


  /*
  -------------------------------------------------------
  REQUIRED FIELDS
  -------------------------------------------------------
  */

  if (
    !electionName ||
    !req.body.start_time ||
    !req.body.end_time
  ) {

    return res.status(400).json({

      error:
        'Please fill in all required fields.',

    });

  }


  /*
  -------------------------------------------------------
  DATE VALIDATION
  -------------------------------------------------------
  */

  if (start.error) {

    return res.status(400).json({

      error:
        start.error,

    });

  }


  if (end.error) {

    return res.status(400).json({

      error:
        end.error,

    });

  }


  /*
  -------------------------------------------------------
  END TIME MUST BE AFTER START TIME
  -------------------------------------------------------
  */

  if (
    new Date(end.value) <=
    new Date(start.value)
  ) {

    return res.status(400).json({

      error:
        'End time must be after start time.',

    });

  }


  /*
  -------------------------------------------------------
  EXPECTED VOTERS
  -------------------------------------------------------
  */

  let expectedVoters = null;


  if (
    expectedVotersRaw !== undefined &&
    expectedVotersRaw !== null &&
    expectedVotersRaw !== ''
  ) {

    expectedVoters =
      Number(
        expectedVotersRaw
      );


    if (
      !Number.isInteger(
        expectedVoters
      ) ||
      expectedVoters < 0
    ) {

      return res.status(400).json({

        error:
          'Expected voters must be a whole number.',

      });

    }

  }


  /*
  -------------------------------------------------------
  POSITIONS
  -------------------------------------------------------
  */

  const incomingPositions =
    Array.isArray(
      req.body.positions
    )
      ? req.body.positions
      : [];


  try {

    const created =
      await db.withTransaction(
        async (client) => {

          /*
          ---------------------------------------------
          GENERATE UNIQUE ELECTION CODE
          ---------------------------------------------
          */

          const code =
            await uniqueElectionCode(
              client
            );


          /*
          ---------------------------------------------
          GENERATE ELECTION KEY
          ---------------------------------------------
          */

          const key =
            generateElectionKey();


          /*
          ---------------------------------------------
          PROTECT ELECTION KEY
          ---------------------------------------------
          */

          const protectedKey =
            await protectElectionKey(
              key
            );


          /*
          ---------------------------------------------
          CALCULATE STATUS
          ---------------------------------------------
          */

          const status =
            computeStatus(
              start.value,
              end.value
            );


          /*
          ---------------------------------------------
          INSERT ELECTION
          ---------------------------------------------
          */

          const electionResult =
            await client.query(

              `
              INSERT INTO elections (

                election_code,
                election_name,
                description,

                election_key,
                election_key_hash,

                start_time,
                end_time,
                status,

                expected_voters,

                first_year_limit,
                second_year_limit,
                third_year_limit,
                fourth_year_limit,

                professor_id

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

                $9,

                $10,
                $11,
                $12,
                $13,

                $14

              )

              RETURNING *
              `,

              [

                code,

                electionName,

                description,

                protectedKey.stored,

                protectedKey.hash,

                start.value,

                end.value,

                status,

                expectedVoters,

                yearLimits['1st Year'],

                yearLimits['2nd Year'],

                yearLimits['3rd Year'],

                yearLimits['4th Year'],

                req.professor.id,

              ]

            );


          const election =
            electionResult.rows[0];


          /*
          ---------------------------------------------
          INSERT POSITIONS + CANDIDATES
          ---------------------------------------------
          */

          for (
            const position
            of incomingPositions
          ) {

            const positionName =
              requiredString(
                position.position_name,
                255
              );


            if (!positionName) {
              continue;
            }


            const positionResult =
              await client.query(

                `
                INSERT INTO positions (
                  election_id,
                  position_name
                )

                VALUES ($1, $2)

                RETURNING *
                `,

                [
                  election.id,
                  positionName,
                ]

              );


            const candidates =
              Array.isArray(
                position.candidates
              )
                ? position.candidates
                : [];


            for (
              const candidate
              of candidates
            ) {

              const candidateName =
                requiredString(
                  candidate.candidate_name,
                  255
                );


              if (!candidateName) {
                continue;
              }


              await client.query(

                `
                INSERT INTO candidates (

                  position_id,
                  candidate_name,
                  branch,
                  year,
                  manifesto

                )

                VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  $5
                )
                `,

                [

                  positionResult.rows[0].id,

                  candidateName,

                  requiredString(
                    candidate.branch,
                    255
                  ),

                  requiredString(
                    candidate.year,
                    50
                  ),

                  String(
                    candidate.manifesto || ''
                  ).trim() || null,

                ]

              );

            }

          }


          /*
          ---------------------------------------------
          RETURN ELECTION + PLAIN KEY
          ---------------------------------------------
          */

          return {

            election,

            plainElectionKey:
              key,

          };

        }
      );


    /*
    -----------------------------------------------------
    RESPONSE
    -----------------------------------------------------
    */

    return res.status(201).json({

      election: {

        ...professorElection(
          created.election
        ),

        election_key:
          created.plainElectionKey,

      },

      election_link:
        `/election/${created.election.election_code}`,

    });


  } catch (error) {

    console.error(
      'Create election error:',
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
LIST PROFESSOR ELECTIONS
=========================================================
*/

async function listElections(req, res) {

  try {

    const result =
      await db.query(

        `
        SELECT

          e.*,

          COALESCE(
            v.total_votes,
            0
          )::int AS total_votes

        FROM elections e

        LEFT JOIN (

          SELECT

            election_id,

            COUNT(*) AS total_votes

          FROM votes

          GROUP BY election_id

        ) v

        ON v.election_id = e.id

        WHERE e.professor_id = $1

        AND e.archived_at IS NULL

        ORDER BY

          e.is_priority DESC,

          e.created_at DESC
        `,

        [
          req.professor.id,
        ]

      );


    return res.json({

      elections:

        result.rows.map(
          (row) => ({

            ...professorElection(
              row
            ),

            total_votes:
              Number(
                row.total_votes || 0
              ),

            is_priority:
              Boolean(
                row.is_priority
              ),

          })
        ),

    });


  } catch (error) {

    console.error(
      'List elections error:',
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
GET PUBLIC ELECTION
=========================================================
*/

async function getPublicElection(req, res) {

  const code =
    requiredString(
      req.params.electionCode,
      32
    );


  if (!code) {

    return res.status(400).json({

      error:
        'Election not found.',

    });

  }


  try {

    const result =
      await db.query(

        `
        SELECT *

        FROM elections

        WHERE election_code = $1
        `,

        [
          code.toUpperCase(),
        ]

      );


    if (!result.rows[0]) {

      return res.status(404).json({

        error:
          'Election not found.',

      });

    }


    return res.json({

      election:
        publicElection(
          result.rows[0]
        ),

    });


  } catch (error) {

    console.error(
      'Get election error:',
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
ADD POSITION
=========================================================
*/

async function addPosition(req, res) {

  const electionId =
    Number(
      req.params.electionId
    );


  const positionName =
    requiredString(
      req.body.position_name,
      255
    );


  if (
    !electionId ||
    !positionName
  ) {

    return res.status(400).json({

      error:
        'Please fill in all required fields.',

    });

  }


  try {

    const election =
      await db.query(

        `
        SELECT *

        FROM elections

        WHERE id = $1

        AND professor_id = $2
        `,

        [
          electionId,
          req.professor.id,
        ]

      );


    if (!election.rows[0]) {

      return res.status(404).json({

        error:
          'Election not found.',

      });

    }


    /*
    -----------------------------------------------------
    DO NOT MODIFY ELECTION AFTER IT HAS STARTED
    -----------------------------------------------------
    */

    const currentStatus =
      computeStatus(
        election.rows[0].start_time,
        election.rows[0].end_time
      );


    if (
      currentStatus !== 'Scheduled'
    ) {

      return res.status(400).json({

        error:
          'Positions cannot be added after the election has started.',

      });

    }


    const result =
      await db.query(

        `
        INSERT INTO positions (
          election_id,
          position_name
        )

        VALUES ($1, $2)

        RETURNING *
        `,

        [
          electionId,
          positionName,
        ]

      );


    return res.status(201).json({

      position:
        result.rows[0],

    });


  } catch (error) {

    console.error(
      'Add position error:',
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
ADD CANDIDATE
=========================================================
*/

async function addCandidate(req, res) {

  const positionId =
    Number(
      req.params.positionId
    );


  const candidateName =
    requiredString(
      req.body.candidate_name,
      255
    );


  if (
    !positionId ||
    !candidateName
  ) {

    return res.status(400).json({

      error:
        'Please fill in all required fields.',

    });

  }


  try {

    const position =
      await db.query(

        `
        SELECT

          p.id,

          e.start_time,
          e.end_time

        FROM positions p

        JOIN elections e

        ON e.id = p.election_id

        WHERE p.id = $1

        AND e.professor_id = $2
        `,

        [
          positionId,
          req.professor.id,
        ]

      );


    if (!position.rows[0]) {

      return res.status(404).json({

        error:
          'Position not found.',

      });

    }


    /*
    -----------------------------------------------------
    DO NOT MODIFY ELECTION AFTER IT HAS STARTED
    -----------------------------------------------------
    */

    const currentStatus =
      computeStatus(

        position.rows[0].start_time,

        position.rows[0].end_time

      );


    if (
      currentStatus !== 'Scheduled'
    ) {

      return res.status(400).json({

        error:
          'Candidates cannot be added after the election has started.',

      });

    }


    const result =
      await db.query(

        `
        INSERT INTO candidates (

          position_id,
          candidate_name,
          branch,
          year,
          manifesto

        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )

        RETURNING *
        `,

        [

          positionId,

          candidateName,

          requiredString(
            req.body.branch,
            255
          ),

          requiredString(
            req.body.year,
            50
          ),

          String(
            req.body.manifesto || ''
          ).trim() || null,

        ]

      );


    return res.status(201).json({

      candidate:
        result.rows[0],

    });


  } catch (error) {

    console.error(
      'Add candidate error:',
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
TOGGLE PRIORITY
=========================================================
*/

async function togglePriority(req, res) {

  const electionId =
    Number(
      req.params.electionId
    );


  if (!electionId) {

    return res.status(400).json({

      error:
        'Election not found.',

    });

  }


  const isPriority =
    req.body.is_priority === true ||
    req.body.is_priority === 'true';


  try {

    const result =
      await db.query(

        `
        UPDATE elections

        SET
          is_priority = $1

        WHERE id = $2

        AND professor_id = $3

        AND archived_at IS NULL

        RETURNING
          id,
          election_name,
          is_priority
        `,

        [

          isPriority,

          electionId,

          req.professor.id,

        ]

      );


    if (!result.rows[0]) {

      return res.status(404).json({

        error:
          'Election not found.',

      });

    }


    return res.json({

      message:

        isPriority

          ? 'Election saved as priority.'

          : 'Election removed from priority.',

      election:
        result.rows[0],

    });


  } catch (error) {

    console.error(
      'Priority update error:',
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
ARCHIVE ELECTION
=========================================================
*/

async function archiveElection(req, res) {

  const electionId =
    Number(
      req.params.electionId
    );


  if (!electionId) {

    return res.status(400).json({

      error:
        'Election not found.',

    });

  }


  try {

    /*
    -----------------------------------------------------
    IMPORTANT:
    Use end_time < NOW()

    Do NOT depend on database status column,
    because status may not be automatically updated.
    -----------------------------------------------------
    */

    const result =
      await db.query(

        `
        UPDATE elections

        SET

          archived_at = NOW(),

          is_priority = FALSE

        WHERE id = $1

        AND professor_id = $2

        AND archived_at IS NULL

        AND end_time < NOW()

        RETURNING

          id,
          election_name,
          archived_at
        `,

        [

          electionId,

          req.professor.id,

        ]

      );


    if (!result.rows[0]) {

      return res.status(400).json({

        error:
          'Only completed elections can be archived.',

      });

    }


    return res.json({

      message:
        'Election archived successfully.',

      election:
        result.rows[0],

    });


  } catch (error) {

    console.error(
      'Archive election error:',
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
GET PUBLIC LIVE RESULTS
=========================================================
*/

async function getPublicLiveResults(req, res) {

  const code =
    requiredString(
      req.params.electionCode,
      32
    );


  if (!code) {

    return res.status(400).json({

      error:
        'Election not found.',

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

        `
        SELECT

          id,
          election_code,
          election_name,
          description,
          start_time,
          end_time,
          status,
          expected_voters,
          created_at

        FROM elections

        WHERE election_code = $1

        AND archived_at IS NULL
        `,

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
    GET POSITIONS + CANDIDATES + LIVE VOTE COUNTS
    -----------------------------------------------------
    */

    const positionsResult =
      await db.query(

        `
        SELECT

          p.id AS position_id,

          p.position_name,

          c.id AS candidate_id,

          c.candidate_name,

          c.branch,

          c.year,

          COALESCE(
            v.vote_count,
            0
          )::int AS vote_count

        FROM positions p

        LEFT JOIN candidates c

          ON c.position_id = p.id

        LEFT JOIN (

          SELECT

            candidate_id,

            COUNT(*) AS vote_count

          FROM votes

          WHERE election_id = $1

          GROUP BY candidate_id

        ) v

          ON v.candidate_id = c.id

        WHERE p.election_id = $1

        ORDER BY

          p.id,

          vote_count DESC,

          c.id
        `,

        [
          election.id,
        ]

      );


    /*
    -----------------------------------------------------
    TOTAL VOTES
    -----------------------------------------------------
    */

    const totalResult =
      await db.query(

        `
        SELECT

          COUNT(*)::int AS total_votes

        FROM votes

        WHERE election_id = $1
        `,

        [
          election.id,
        ]

      );


    const totalVotes =
      Number(
        totalResult.rows[0].total_votes || 0
      );


    /*
    -----------------------------------------------------
    CREATE POSITION MAP
    -----------------------------------------------------
    */

    const positionsMap =
      new Map();


    for (
      const row
      of positionsResult.rows
    ) {

      if (
        !positionsMap.has(
          row.position_id
        )
      ) {

        positionsMap.set(

          row.position_id,

          {

            id:
              row.position_id,

            position_name:
              row.position_name,

            candidates: [],

          }

        );

      }


      if (row.candidate_id) {

        positionsMap
          .get(
            row.position_id
          )
          .candidates
          .push({

            id:
              row.candidate_id,

            candidate_name:
              row.candidate_name,

            branch:
              row.branch,

            year:
              row.year,

            votes:
              Number(
                row.vote_count || 0
              ),

          });

      }

    }


    /*
    -----------------------------------------------------
    FINAL PUBLIC RESPONSE
    -----------------------------------------------------
    */

    return res.json({

      election: {

        id:
          election.id,

        election_code:
          election.election_code,

        election_name:
          election.election_name,

        description:
          election.description,

        start_time:
          election.start_time,

        end_time:
          election.end_time,

        status:
          computeStatus(
            election.start_time,
            election.end_time
          ),

        expected_voters:
          election.expected_voters,

      },


      total_votes:
        totalVotes,


      positions:
        Array.from(
          positionsMap.values()
        ),

    });


  } catch (error) {

    console.error(
      'Public live results error:',
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
GET RESULTS
=========================================================
*/

async function getResults(req, res) {

  const electionId =
    Number(
      req.params.electionId
    );


  if (!electionId) {

    return res.status(400).json({

      error:
        'Election not found.',

    });

  }


  try {

    /*
    -----------------------------------------------
    GET ELECTION
    -----------------------------------------------
    */

    const electionResult =
      await db.query(

        `
        SELECT *

        FROM elections

        WHERE id = $1

        AND professor_id = $2
        `,

        [

          electionId,

          req.professor.id,

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
    -----------------------------------------------
    GET POSITIONS + CANDIDATES + VOTE COUNTS
    -----------------------------------------------
    */

    const positionsResult =
      await db.query(

        `
        SELECT

          p.id AS position_id,

          p.position_name,

          c.id AS candidate_id,

          c.candidate_name,

          c.branch,

          c.year,

          c.manifesto,

          COALESCE(
            v.vote_count,
            0
          )::int AS vote_count

        FROM positions p

        LEFT JOIN candidates c

        ON c.position_id = p.id

        LEFT JOIN (

          SELECT

            candidate_id,

            COUNT(*) AS vote_count

          FROM votes

          WHERE election_id = $1

          GROUP BY candidate_id

        ) v

        ON v.candidate_id = c.id

        WHERE p.election_id = $1

        ORDER BY

          p.id,

          c.id
        `,

        [
          electionId,
        ]

      );


    /*
    -----------------------------------------------
    TOTAL VOTES
    -----------------------------------------------
    */

    const totalResult =
      await db.query(

        `
        SELECT

          COUNT(*)::int AS total_votes

        FROM votes

        WHERE election_id = $1
        `,

        [
          electionId,
        ]

      );


    const totalVotes =
      totalResult.rows[0]
        .total_votes;


    /*
    -----------------------------------------------
    UNIQUE STUDENTS WHO VOTED
    -----------------------------------------------
    */

    const studentsCountResult =
      await db.query(

        `
        SELECT

          COUNT(*)::int
            AS total_students_voted

        FROM (

          SELECT DISTINCT

            email_normalized,

            student_year

          FROM votes

          WHERE election_id = $1

        ) AS unique_students
        `,

        [
          electionId,
        ]

      );


    const totalStudentsVoted =
      studentsCountResult.rows[0]
        .total_students_voted;


    /*
    -----------------------------------------------
    STUDENTS WHO VOTED
    -----------------------------------------------
    */

    const studentsResult =
      await db.query(

        `
        SELECT

          student_name,

          roll_no,

          branch,

          student_year,

          email,

          voted_at

        FROM (

          SELECT DISTINCT ON (

            email_normalized,

            student_year

          )

            student_name,

            roll_no,

            branch,

            student_year,

            email,

            voted_at

          FROM votes

          WHERE election_id = $1

          ORDER BY

            email_normalized,

            student_year,

            voted_at ASC

        ) AS unique_students

        ORDER BY voted_at ASC
        `,

        [
          electionId,
        ]

      );


    /*
    -----------------------------------------------
    VOTING PERCENTAGE
    -----------------------------------------------
    */

    const expected =
      election.expected_voters;


    const votingPercentage =
      expected && expected > 0

        ? Math.round(

            (
              totalStudentsVoted /
              expected
            ) * 1000

          ) / 10

        : null;


    /*
    -----------------------------------------------
    CREATE POSITIONS MAP
    -----------------------------------------------
    */

    const positionsMap =
      new Map();


    for (
      const row
      of positionsResult.rows
    ) {

      if (
        !positionsMap.has(
          row.position_id
        )
      ) {

        positionsMap.set(

          row.position_id,

          {

            id:
              row.position_id,

            position_name:
              row.position_name,

            candidates: [],

          }

        );

      }


      if (row.candidate_id) {

        positionsMap

          .get(
            row.position_id
          )

          .candidates

          .push({

            id:
              row.candidate_id,

            candidate_name:
              row.candidate_name,

            branch:
              row.branch,

            year:
              row.year,

            manifesto:
              row.manifesto,

            votes:
              row.vote_count,

          });

      }

    }


    /*
    -----------------------------------------------
    FINAL RESPONSE
    -----------------------------------------------
    */

    return res.json({

      election:

        {

          ...professorElection(
            election
          ),

          is_priority:
            Boolean(
              election.is_priority
            ),

        },


      total_votes:
        totalVotes,


      total_students_voted:
        totalStudentsVoted,


      expected_voters:
        expected,


      voting_percentage:
        votingPercentage,


      positions:

        Array.from(
          positionsMap.values()
        ),


      /*
      ---------------------------------------------
      STUDENTS WHO VOTED
      ---------------------------------------------
      */

      students:

        studentsResult.rows.map(

          (student) => ({

            student_name:
              student.student_name,

            roll_no:
              student.roll_no,

            branch:
              student.branch,

            year:
              student.student_year,

            email:
              student.email,

            voted_at:
              student.voted_at,

          })

        ),

    });


  } catch (error) {

    console.error(
      'Get results error:',
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
GET STATS
=========================================================
*/

async function getStats(req, res) {

  return getResults(
    req,
    res
  );

}


/*
=========================================================
EXPORT
=========================================================
*/
module.exports = {

  createElection,

  listElections,

  getPublicElection,

  getPublicLiveResults,

  addPosition,

  addCandidate,

  togglePriority,

  archiveElection,

  getResults,

  getStats,

};