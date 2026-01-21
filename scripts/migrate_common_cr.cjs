const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables correctly
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Try root .env if not in server

// Debug: Check if loaded (don't print full secret)
console.log("DB URL Loaded:", process.env.DATABASE_URL ? "Yes" : "No");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Re-enable SSL for Neon/Production
});

async function migrate() {
    try {
        console.log("🚀 Starting Migration: Add res_toilets_common...");

        // Check if column exists
        const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='school_profiles' AND column_name='res_toilets_common';
    `;
        const checkRes = await pool.query(checkQuery);

        if (checkRes.rows.length > 0) {
            console.log("⚠️ Column 'res_toilets_common' already exists. Skipping.");
        } else {
            const alterQuery = `ALTER TABLE school_profiles ADD COLUMN res_toilets_common INTEGER DEFAULT 0;`;
            await pool.query(alterQuery);
            console.log("✅ Successfully added 'res_toilets_common' column.");
        }

    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        pool.end();
    }
}

migrate();
