const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function listColumns() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'school_profiles'
        `);
        console.error("Total Columns:", res.rows.length);
        console.log(JSON.stringify(res.rows.map(r => r.column_name), null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

listColumns();
