
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function findControlId() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE column_name = 'control_id'
        `);
        console.log("Global Search for 'control_id':");
        console.table(res.rows);
    } catch (err) {
        console.error("Search failed:", err);
    } finally {
        await pool.end();
    }
}

findControlId();
