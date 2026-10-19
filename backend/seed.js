require('dotenv').config();

const bcrypt = require('bcrypt');
const db = require('./db');

async function seed() {
  if (process.env.ALLOW_DEV_SEED !== 'true') {
    console.error('This script is development-only.');
    console.error('It does not run during npm start and will not create a real election.');
    console.error('To create a development professor only, set ALLOW_DEV_SEED=true and run: npm run seed:dev');
    console.error('For a real election administrator, use: npm run create-professor');
    process.exit(1);
  }

  const email = 'professor.demo@college.edu';
  const password = 'DevOnly@ChangeMe';
  const passwordHash = await bcrypt.hash(password, 10);

  await db.query(
    `INSERT INTO professors (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email)
     DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash`,
    ['Development Professor', email, passwordHash]
  );

  console.log('Development professor created. No elections, candidates, or votes were inserted.');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log('Do not use this account for a real college election.');
  await db.pool.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});
