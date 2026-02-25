import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'users'");
    console.log('--- USERS TABLE COLUMNS ---');
    res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type} (Nullable: ${r.is_nullable}, Default: ${r.column_default})`));
    
    // Insert the user
    console.log('\\n--- INSERTING USER ---');
    const insertRes = await pool.query(`
      INSERT INTO users (uid, email, role, first_name, last_name, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (uid) DO NOTHING
      RETURNING *;
    `, ['f8mbQQBKfwcgyDfTHeb8cRqRDNwE2', '110211@insighted.app', 'School Head', 'Claudia', 'Elementary School']);
    
    console.log('Insert Result:', insertRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
