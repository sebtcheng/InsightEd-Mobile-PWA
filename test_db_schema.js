import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const client = await pool.connect();

        // Query to get column names of lgu_projects
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lgu_projects'
      ORDER BY ordinal_position;
    `);

        const output = JSON.stringify(res.rows, null, 2);
        fs.writeFileSync('schema_output.txt', output);

        client.release();
    } catch (err) {
        fs.writeFileSync('schema_output.txt', "Error: " + err.message);
    } finally {
        pool.end();
    }
}

checkSchema();
