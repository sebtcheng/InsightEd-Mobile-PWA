const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkSchema() {
    try {
        const client = await pool.connect();
        console.log("Connected to database.");

        // Get column names
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schools'
      ORDER BY column_name;
    `);

        console.log("Columns in 'schools' table:");
        console.log(res.rows.map(r => r.column_name).join(', '));

        // Sample data for potential grouping columns
        const sample = await client.query(`
      SELECT school_id, region, division, district, municipality, leg_district 
      FROM schools 
      LIMIT 5;
    `);

        console.log("\nSample Data:");
        console.table(sample.rows);

        client.release();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

checkSchema();
