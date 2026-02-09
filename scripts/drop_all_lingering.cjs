const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function dropAllLingering() {
    console.log("Dropping lingering columns: res_faucets, res_internet_type, res_ownership_type...");
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE school_profiles 
            DROP COLUMN IF EXISTS res_faucets,
            DROP COLUMN IF EXISTS res_internet_type,
            DROP COLUMN IF EXISTS res_ownership_type;
        `);
        console.log("✅ Lingering columns dropped successfully.");
    } catch (err) {
        console.error("❌ Error dropping columns:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

dropAllLingering();
