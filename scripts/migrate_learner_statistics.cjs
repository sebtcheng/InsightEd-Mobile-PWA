
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    console.log("🚀 Migrating Learner Statistics Columns...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const columns = [
            // Special Programs
            "stat_sned_es INTEGER DEFAULT 0",
            "stat_sned_jhs INTEGER DEFAULT 0",
            "stat_sned_shs INTEGER DEFAULT 0",
            "stat_disability_es INTEGER DEFAULT 0",
            "stat_disability_jhs INTEGER DEFAULT 0",
            "stat_disability_shs INTEGER DEFAULT 0",
            "stat_als_es INTEGER DEFAULT 0",
            "stat_als_jhs INTEGER DEFAULT 0",
            "stat_als_shs INTEGER DEFAULT 0",

            // Muslim Learners
            "stat_muslim_k INTEGER DEFAULT 0",
            "stat_muslim_g1 INTEGER DEFAULT 0",
            "stat_muslim_g2 INTEGER DEFAULT 0",
            "stat_muslim_g3 INTEGER DEFAULT 0",
            "stat_muslim_g4 INTEGER DEFAULT 0",
            "stat_muslim_g5 INTEGER DEFAULT 0",
            "stat_muslim_g6 INTEGER DEFAULT 0",
            "stat_muslim_g7 INTEGER DEFAULT 0",
            "stat_muslim_g8 INTEGER DEFAULT 0",
            "stat_muslim_g9 INTEGER DEFAULT 0",
            "stat_muslim_g10 INTEGER DEFAULT 0",
            "stat_muslim_g11 INTEGER DEFAULT 0",
            "stat_muslim_g12 INTEGER DEFAULT 0",

            // Status / Vulnerable
            "stat_ip INTEGER DEFAULT 0",
            "stat_displaced INTEGER DEFAULT 0",
            "stat_repetition INTEGER DEFAULT 0",
            "stat_overage INTEGER DEFAULT 0",
            "stat_dropout_prev_sy INTEGER DEFAULT 0"
        ];

        for (const col of columns) {
            const colName = col.split(' ')[0];
            // Check if column exists first
            const checkRes = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='school_profiles' AND column_name=$1
            `, [colName]);

            if (checkRes.rows.length === 0) {
                await client.query(`ALTER TABLE school_profiles ADD COLUMN ${col}`);
                console.log(`✅ Added column: ${colName}`);
            } else {
                console.log(`ℹ️ Column ${colName} already exists.`);
            }
        }

        await client.query('COMMIT');
        console.log("🎊 Learner Statistics migration completed!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
