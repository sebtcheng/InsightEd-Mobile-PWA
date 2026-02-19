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

        // 1. Add municipality to finance_projects
        await client.query(`
      ALTER TABLE finance_projects 
      ADD COLUMN IF NOT EXISTS municipality TEXT;
    `);
        console.log("✅ Added 'municipality' to 'finance_projects'");

        // 2. Add municipality and finance_ref_id to lgu_projects
        await client.query(`
      ALTER TABLE lgu_projects 
      ADD COLUMN IF NOT EXISTS municipality TEXT,
      ADD COLUMN IF NOT EXISTS finance_ref_id INTEGER;
    `);
        console.log("✅ Added 'municipality' and 'finance_ref_id' to 'lgu_projects'");

        client.release();
    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        pool.end();
    }
}

runMigration();
