
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6aW9NeDShylE@ep-crimson-firefly-a13367y4-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkMissingColumns() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'engineer_form';
        `);

        const existingColumns = res.rows.map(r => r.column_name);
        const expected = [
            'number_of_classrooms',
            'number_of_sites',
            'number_of_storeys',
            'funds_utilized'
        ];

        console.log("Existing columns:", existingColumns);

        const missing = expected.filter(col => !existingColumns.includes(col));

        if (missing.length > 0) {
            console.log("\n❌ MISSING COLUMNS:", missing);
        } else {
            console.log("\n✅ All columns present.");
        }

        client.release();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

checkMissingColumns();
