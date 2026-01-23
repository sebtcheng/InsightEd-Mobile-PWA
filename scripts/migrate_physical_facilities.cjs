const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables correctly
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log("🚀 Starting Migration: Add Classroom Metrics...");

        const columns = [
            'build_classrooms_total',
            'build_classrooms_new',
            'build_classrooms_good',
            'build_classrooms_repair',
            'build_classrooms_demolition'
        ];

        for (const col of columns) {
            // Check if column exists
            const checkQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='school_profiles' AND column_name='${col}';
        `;
            const checkRes = await pool.query(checkQuery);

            if (checkRes.rows.length > 0) {
                console.log(`⚠️ Column '${col}' already exists. Skipping.`);
            } else {
                const alterQuery = `ALTER TABLE school_profiles ADD COLUMN ${col} INTEGER DEFAULT 0;`;
                await pool.query(alterQuery);
                console.log(`✅ Successfully added '${col}' column.`);
            }
        }

    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        pool.end();
    }
}

migrate();
