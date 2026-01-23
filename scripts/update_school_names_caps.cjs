
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function updateSchoolNames() {
    console.log("🚀 Starting Database Update: Converting all school names to UPPERCASE...");
    try {
        const res = await pool.query(`
            UPDATE school_profiles 
            SET school_name = UPPER(school_name)
            WHERE school_name IS NOT NULL;
        `);
        console.log(`✅ Successfully updated ${res.rowCount} school titles to uppercase.`);
    } catch (err) {
        console.error("❌ Update failed:", err);
    } finally {
        await pool.end();
    }
}

updateSchoolNames();
