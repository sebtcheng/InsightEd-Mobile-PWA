
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debug() {
    try {
        console.log("--- Checking 'schools' table columns ---");
        const schemaRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schools';
    `);
        console.log(schemaRes.rows.map(r => r.column_name));

        console.log("\n--- Fetching one row from 'schools' ---");
        const dataRes = await pool.query(`SELECT * FROM schools LIMIT 1`);
        console.log(dataRes.rows[0]);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

debug();
