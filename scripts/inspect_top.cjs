
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function inspectTop() {
    try {
        const res = await pool.query(`
            SELECT column_name, ordinal_position, data_type
            FROM information_schema.columns 
            WHERE table_name = 'school_profiles' 
            AND ordinal_position <= 10
            ORDER BY ordinal_position
        `);
        console.table(res.rows);
    } catch (err) {
        console.error("Inspection failed:", err);
    } finally {
        await pool.end();
    }
}

inspectTop();
