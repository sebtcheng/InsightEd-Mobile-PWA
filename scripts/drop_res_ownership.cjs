const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function dropOwnership() {
    console.log("Dropping res_ownership_type column...");
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE school_profiles 
            DROP COLUMN IF EXISTS res_ownership_type;
        `);
        console.log("✅ res_ownership_type column dropped successfully.");
    } catch (err) {
        console.error("❌ Error dropping column:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

dropOwnership();
