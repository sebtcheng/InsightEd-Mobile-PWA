
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function addMissingColumns() {
    try {
        const client = await pool.connect();

        console.log("🚀 Starting migration...");

        // Array of columns to add
        const columns = [
            { name: 'number_of_classrooms', type: 'INTEGER DEFAULT 0' },
            { name: 'number_of_sites', type: 'INTEGER DEFAULT 0' },
            { name: 'number_of_storeys', type: 'INTEGER DEFAULT 0' },
            { name: 'funds_utilized', type: 'NUMERIC DEFAULT 0' }
        ];

        for (const col of columns) {
            try {
                console.log(`Checking/Adding ${col.name}...`);
                await client.query(`
                    ALTER TABLE "engineer_form" 
                    ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};
                `);
                console.log(`✅ ${col.name} is ready.`);
            } catch (e) {
                console.error(`❌ Failed to add ${col.name}:`, e.message);
            }
        }

        console.log("\nMigration finished.");
        client.release();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

addMissingColumns();
