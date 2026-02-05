import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { require: true },
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("🚀 Starting Migration for project_documents...");
        await client.query('BEGIN');

        // 1. Ensure Table Exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS project_documents (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                document_type TEXT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Add New Columns (Idempotent)
        const columns = [
            'file_url TEXT',
            'storage_path TEXT',
            'uploaded_by TEXT',
            'file_size INTEGER',
            'content_type TEXT'
        ];

        for (const col of columns) {
            await client.query(`ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS ${col};`);
        }

        // 3. Optional: Check for old 'file_data' and warn (or drop if user confirmed, but we'll specificially NOT drop for safety, just ignore it)
        const res = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'project_documents' AND column_name = 'file_data';
        `);

        if (res.rows.length > 0) {
            console.log("⚠️  'file_data' column exists. It will be ignored by new logic.");
            // await client.query("ALTER TABLE project_documents DROP COLUMN file_data;"); // Uncomment if aggressive cleanup is desired
        }

        await client.query('COMMIT');
        console.log("✅ Schema for project_documents updated successfully.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
