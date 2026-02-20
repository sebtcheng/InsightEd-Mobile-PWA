const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        // Check column type
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'schools' AND column_name = 'school_id';
    `);
        console.log('Column Type:', res.rows);

        // Check sample data for whitespace
        const sample = await pool.query(`
      SELECT school_id, length(school_id) as len 
      FROM schools 
      LIMIT 5
    `);
        console.log('Sample Data:', sample.rows);

        // Check specifically for user's likely test case (if we can find one, or just general)
        // We'll search for the one used in my debug test '100000'
        const specific = await pool.query(`
      SELECT school_id, length(school_id) as len 
      FROM schools 
      WHERE school_id = '100000' OR school_id LIKE '100000%'
    `);
        console.log('Specific Check 100000:', specific.rows);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSchema();
