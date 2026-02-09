const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function listResourceColumns() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, ordinal_position
            FROM information_schema.columns
            WHERE table_name = 'school_profiles'
            AND column_name LIKE 'res_%'
            ORDER BY ordinal_position;
        `);

        console.log("Resource Columns in Order:");
        res.rows.forEach(r => console.log(`${r.ordinal_position}: ${r.column_name}`));
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

listResourceColumns();
