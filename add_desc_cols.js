
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function migrate() {
    try {
        const client = await pool.connect();
        console.log("🚀 Adding description columns...");

        await client.query(`
            ALTER TABLE engineer_form 
            ADD COLUMN IF NOT EXISTS internal_description TEXT,
            ADD COLUMN IF NOT EXISTS external_description TEXT;
        `);

        console.log("✅ Columns added.");
        client.release();
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        pool.end();
    }
}
migrate();
