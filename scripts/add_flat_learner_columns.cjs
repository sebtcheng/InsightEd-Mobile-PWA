
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Adding flat K-12 columns for ALL learner categories...");

        await client.query('BEGIN');

        const categories = [
            'stat_sned',
            'stat_disability',
            'stat_als', // Even ALS will get K-12 cols for consistency if using the grid
            'stat_ip',
            'stat_displaced',
            'stat_repetition',
            'stat_overage',
            'stat_dropout' // will use stat_dropout_k, etc.
        ];

        const grades = ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];

        for (const cat of categories) {
            for (const grade of grades) {
                const colName = `${cat}_${grade}`;
                // Add column if not exists, integer, default 0
                const query = `ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS ${colName} INT DEFAULT 0;`;
                await client.query(query);
            }
        }

        await client.query('COMMIT');
        console.log("✅ Added ~100 flat K-12 columns successfully.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
