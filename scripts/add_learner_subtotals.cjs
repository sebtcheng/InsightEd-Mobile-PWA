
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Adding subtotal columns for Learner Statistics...");

        await client.query('BEGIN');

        const columnsToAdd = [
            // IP
            'stat_ip_es INT DEFAULT 0', 'stat_ip_jhs INT DEFAULT 0', 'stat_ip_shs INT DEFAULT 0',
            // Displaced
            'stat_displaced_es INT DEFAULT 0', 'stat_displaced_jhs INT DEFAULT 0', 'stat_displaced_shs INT DEFAULT 0',
            // Repetition
            'stat_repetition_es INT DEFAULT 0', 'stat_repetition_jhs INT DEFAULT 0', 'stat_repetition_shs INT DEFAULT 0',
            // Overage
            'stat_overage_es INT DEFAULT 0', 'stat_overage_jhs INT DEFAULT 0', 'stat_overage_shs INT DEFAULT 0',
            // Dropouts
            'stat_dropout_es INT DEFAULT 0', 'stat_dropout_jhs INT DEFAULT 0', 'stat_dropout_shs INT DEFAULT 0',
        ];

        for (const col of columnsToAdd) {
            await client.query(`ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS ${col};`);
        }

        // Rename old single columns to avoid confusion? Or keep as Grand Total?
        // User asked for "column for TOTAL". The old columns (stat_ip, etc.) can serve as Grand Total.
        // I will keep them.

        await client.query('COMMIT');
        console.log("✅ Added ES/JHS/SHS subtotal columns.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
