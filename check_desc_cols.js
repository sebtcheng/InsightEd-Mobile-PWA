
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function check() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'engineer_form';
        `);
        const cols = res.rows.map(r => r.column_name);
        console.log("Current Columns:", cols);

        const needed = ['internal_description', 'external_description', 'pow_pdf', 'dupa_pdf', 'contract_pdf'];
        const missing = needed.filter(c => !cols.includes(c));

        console.log("Missing:", missing);
        client.release();
    } catch (err) { console.error(err); } finally { pool.end(); }
}
check();
