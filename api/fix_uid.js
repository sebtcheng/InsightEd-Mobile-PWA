import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function fixUser() {
  try {
    const correctUid = 'f8mbQBKfwcgyDfTHeb8cRqRDNwE2';
    
    // 1. Insert or update the correct UID in the users table
    const insertRes = await pool.query(`
      INSERT INTO users (uid, email, role, first_name, last_name, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (uid) DO UPDATE SET disabled = false
      RETURNING *;
    `, [correctUid, '110211@insighted.app', 'School Head', 'Claudia', 'Elementary School']);
    
    console.log('User inserted/updated:', insertRes.rows);

    // 2. Update the school_profiles table to point to the correct UID
    const updateRes = await pool.query(`
      UPDATE school_profiles
      SET submitted_by = $1
      WHERE school_id = '110211'
      RETURNING *;
    `, [correctUid]);
    
    console.log('School Profile updated:', updateRes.rows);
    
    // 3. Delete the wrong UID from users table if it exists
    await pool.query("DELETE FROM users WHERE uid = 'f8mbQQBKfwcgyDfTHeb8cRqRDNwE2'");

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

fixUser();
