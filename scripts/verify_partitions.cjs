const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'form_school_profile', 'form_school_head', 'form_enrollment', 
                'form_organized_classes', 'form_learner_stats', 'form_shifting_modalities', 
                'form_teaching_personnel', 'form_specialization', 'form_school_resources', 
                'form_physical_facilities'
            )
            ORDER BY table_name;
        `);
        console.log("Found Tables:", res.rows.map(r => r.table_name));
        console.log("Count:", res.rowCount);
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
