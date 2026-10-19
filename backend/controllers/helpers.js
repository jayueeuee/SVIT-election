function computeStatus(startTime, endTime) {
  const now = Date.now();

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 'Scheduled';
  }

  if (now < start) return 'Scheduled';

  if (now > end) return 'Completed';

  return 'Active';
}


function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || '').trim()
  );
}


function requiredString(value, max = 255) {
  const text = String(value || '').trim();

  if (!text || text.length > max) {
    return null;
  }

  return text;
}


function publicElection(row) {
  const status = computeStatus(
    row.start_time,
    row.end_time
  );

  return {
    id: row.id,

    election_code:
      row.election_code,

    election_name:
      row.election_name,

    description:
      row.description,

    start_time:
      row.start_time,

    end_time:
      row.end_time,

    status,

    expected_voters:
      row.expected_voters,

    created_at:
      row.created_at,
  };
}


function professorElection(row) {
  return {
    ...publicElection(row),

    election_key:
      row.election_key,

    professor_id:
      row.professor_id,

    /*
    ---------------------------------------------------
    PRIORITY / ARCHIVE
    ---------------------------------------------------
    */

    is_priority:
      Boolean(row.is_priority),

    archived_at:
      row.archived_at || null,
  };
}


module.exports = {
  computeStatus,
  isValidEmail,
  requiredString,
  publicElection,
  professorElection,
};