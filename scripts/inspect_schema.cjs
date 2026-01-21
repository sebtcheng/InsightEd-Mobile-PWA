
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function inspect() {
    try {
        const globalSearch = await pool.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE column_name = 'control_id'
        `);
        console.log("Global search for 'control_id':");
        console.table(globalSearch.rows);

        const tablesRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log("All tables in 'public' schema:");
        console.table(tablesRes.rows);

        const profilesRes = await pool.query(`
            SELECT column_name, ordinal_position, data_type
            FROM information_schema.columns 
            WHERE table_name = 'school_profiles' 
            ORDER BY ordinal_position
        `);
        console.log("Columns in 'school_profiles':");
        console.table(profilesRes.rows);

    } catch (err) {
        console.error("Inspection failed:", err);
    } finally {
        await pool.end();
    }
}

inspect();
