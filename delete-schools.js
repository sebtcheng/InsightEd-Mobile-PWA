import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function deleteSchools() {
    const schoolIds = ['234523', '234526'];

    console.log(`🚀 Attempting to delete School IDs: ${schoolIds.join(', ')}`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const id of schoolIds) {
            // First check if it exists
            const checkRes = await client.query('SELECT school_name FROM schools WHERE school_id = $1', [id]);

            if (checkRes.rows.length === 0) {
                console.warn(`⚠️  School ID ${id} not found.`);
            } else {
                const schoolName = checkRes.rows[0].school_name;
                const delRes = await client.query('DELETE FROM schools WHERE school_id = $1', [id]);
                console.log(`✅ Deleted: ${schoolName} (ID: ${id})`);
            }
        }

        await client.query('COMMIT');
        console.log("🎉 Deletion Complete.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Deletion Failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteSchools();
