const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function forceDrop() {
    console.log("Force dropping res_internet_type...");
    const client = await pool.connect();
    try {
        await client.query(`ALTER TABLE school_profiles DROP COLUMN IF EXISTS res_internet_type;`);
        console.log("✅ res_internet_type dropped.");
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

forceDrop();
