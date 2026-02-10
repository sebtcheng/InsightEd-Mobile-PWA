import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function dropColumns() {
    const client = await pool.connect();
    try {
        console.log("Checking for columns to drop...");

        // Check if columns exist first (optional, but good for logging)
        const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form' 
      AND column_name IN ('internal_description', 'external_description');
    `;

        const checkRes = await client.query(checkQuery);
        const existingCols = checkRes.rows.map(r => r.column_name);

        if (existingCols.length === 0) {
            console.log("✅ Columns 'internal_description' and 'external_description' do not exist. No action needed.");
            return;
        }

        console.log(`Found columns: ${existingCols.join(', ')}. Dropping them now...`);

        const dropQuery = `
      ALTER TABLE engineer_form 
      DROP COLUMN IF EXISTS internal_description,
      DROP COLUMN IF EXISTS external_description;
    `;

        await client.query(dropQuery);
        console.log("✅ Successfully dropped 'internal_description' and 'external_description' columns.");

    } catch (err) {
        console.error("❌ Error dropping columns:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

dropColumns();
