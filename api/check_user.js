import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function checkUser() {
  try {
    const res = await pool.query("SELECT uid, email, role, disabled FROM users WHERE uid = 'f8mbQQBKfwcgyDfTHeb8cRqRDNwE2'");
    console.log('USERS TABLE RESULT FOR UID f8mbQQBKfwcgyDfTHeb8cRqRDNwE2:', res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkUser();
