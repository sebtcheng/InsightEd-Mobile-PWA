
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function dropColumns() {
    try {
        await client.connect();
        console.log("🔌 Connected to database...");

        // specific check if columns exist before dropping? Not strictly necessary with IF EXISTS but good for logs.
        const query = `
            ALTER TABLE engineer_form 
            DROP COLUMN IF EXISTS internal_description,
            DROP COLUMN IF EXISTS external_description;
        `;

        await client.query(query);
        console.log("✅ Successfully dropped 'internal_description' and 'external_description' columns.");

    } catch (err) {
        console.error("❌ Error dropping columns:", err);
    } finally {
        await client.end();
    }
}

dropColumns();
