
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Neon
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Beginning migration: Adding learner_stats_grids JSONB column...");

        await client.query('BEGIN');

        // 1. Add the JSONB column if it doesn't exist
        await client.query(`
      ALTER TABLE school_profiles 
      ADD COLUMN IF NOT EXISTS learner_stats_grids JSONB DEFAULT '{}'::jsonb;
    `);

        console.log("✅ Added 'learner_stats_grids' column.");

        await client.query('COMMIT');
        console.log("Migration completed successfully.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error running migration:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
