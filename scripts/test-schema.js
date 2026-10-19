const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');

const db = newDb();
const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');

try {
  db.public.none(sql);
  console.log('✔ SUCCESS: database/schema.sql parsed and executed cleanly with 0 errors!');
  
  const tables = db.public.many(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  console.log('Created tables:', tables.map(t => t.table_name));

  const professorsCols = db.public.many(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='professors'`);
  console.log('professors columns:', professorsCols.map(c => c.column_name));

  const electionsCols = db.public.many(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='elections'`);
  console.log('elections columns:', electionsCols.map(c => c.column_name));

  const studentsCols = db.public.many(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='students'`);
  console.log('students columns:', studentsCols.map(c => c.column_name));

  const votesCols = db.public.many(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='votes'`);
  console.log('votes columns:', votesCols.map(c => c.column_name));
} catch (err) {
  console.error('❌ SQL Execution error:', err);
}
