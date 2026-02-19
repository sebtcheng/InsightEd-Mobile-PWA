import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB");

        // Add missing column
        await client.query(`
      ALTER TABLE lgu_projects 
      ADD COLUMN IF NOT EXISTS created_by_uid TEXT;
    `);

        console.log("✅ Successfully added 'created_by_uid' column to 'lgu_projects' table.");

        client.release();
    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        pool.end();
    }
}

runMigration();
