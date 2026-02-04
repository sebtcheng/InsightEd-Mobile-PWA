import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
    },
});

async function migrate() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB. Starting migration...");

        // Add Columns
        await client.query(`
        ALTER TABLE engineer_form 
        ADD COLUMN IF NOT EXISTS latitude TEXT,
        ADD COLUMN IF NOT EXISTS longitude TEXT;
    `);

        console.log('✅ Checked/Added Latitude & Longitude to engineer_form');

        // Verify
        const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'engineer_form' 
        AND column_name IN ('latitude', 'longitude');
    `);

        if (res.rows.length === 2) {
            console.log("✅ Verification SUCCESS: Both columns exist.");
        } else {
            console.log("❌ Verification FAILED: Found " + res.rows.length + " columns.");
        }

        client.release();
    } catch (err) {
        console.error("Migration Error:", err);
    } finally {
        pool.end();
    }
}

migrate();
