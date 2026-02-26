import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';
import fs from 'fs';

async function checkRoles() {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && fs.existsSync('.env')) {
    try {
      let envContent = fs.readFileSync('.env', 'utf16le');
      let match = envContent.match(/DATABASE_URL=(.+)/);
      if (!match) {
        envContent = fs.readFileSync('.env', 'utf8');
        match = envContent.match(/DATABASE_URL=(.+)/);
      }
      if (match) {
        dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
      }
    } catch (e) {}
  }

  const isLocal = dbUrl && (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'));
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });

  try {
    const schema = await pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'users\'');
    console.log('Users table schema:');
    console.table(schema.rows);

    const res = await pool.query('SELECT role, COUNT(*) FROM users GROUP BY role');
    console.log('\nUser roles in database:');
    console.table(res.rows);

    // const betaTesters = await pool.query("SELECT uid, email, role, first_name, last_name FROM users WHERE role = 'School Head' AND email NOT LIKE '%@deped.gov.ph%'");
    // console.log('\nPotential mis-saved Beta Testers (Non-DepEd email + School Head role):');
    // console.table(betaTesters.rows);
  } catch (err) {
    console.error('Error checking roles:', err);
  } finally {
    await pool.end();
  }
}

checkRoles();
