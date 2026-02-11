
import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to database...");
        const client = await pool.connect();
        console.log("Connected!");

        try {
            console.log("Running migration...");
            await client.query('ALTER TABLE "lgu_image" ADD COLUMN IF NOT EXISTS category TEXT');
            console.log("✅ Successfully added 'category' column to 'lgu_image' table.");
        } catch (e) {
            console.error("❌ Error adding column:", e.message);
        }

        client.release();
    } catch (err) {
        console.error("❌ Database connection error:", err);
    } finally {
        await pool.end();
    }
}

run();
