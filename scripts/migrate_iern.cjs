
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false // Set to true if your DB requires SSL
});

async function migrate() {
    console.log("🚀 Starting Migration: Add IERN column...");
    try {
        // Add iern column if it doesn't exist
        await pool.query(`
            ALTER TABLE school_profiles 
            ADD COLUMN IF NOT EXISTS iern VARCHAR(20) UNIQUE;
        `);
        console.log("✅ Successfully added 'iern' column.");

    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrate();
