const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function dropResFaucets() {
    console.log("Dropping res_faucets column...");
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE school_profiles 
            DROP COLUMN IF EXISTS res_faucets;
        `);
        console.log("✅ res_faucets column dropped successfully.");
    } catch (err) {
        console.error("❌ Error dropping column:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

dropResFaucets();
