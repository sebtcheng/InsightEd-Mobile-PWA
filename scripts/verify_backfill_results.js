const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    try {
        const teacherCount = await pool.query('SELECT COUNT(*) FROM teacher_specialization_details');
        const schoolCount = await pool.query('SELECT COUNT(*) FROM school_profiles');

        console.log('------------------------------------------');
        console.log('✅ VERIFICATION RESULTS:');
        console.log('Total Teachers in Specialization Details:', teacherCount.rows[0].count);
        console.log('Total Registered Schools in Profiles:', schoolCount.rows[0].count);
        console.log('------------------------------------------');

        // Show a few rows
        const sample = await pool.query('SELECT school_id, full_name, specialization FROM teacher_specialization_details LIMIT 5');
        console.log('Sample Backfilled Data:');
        console.table(sample.rows);

    } catch (err) {
        console.error('❌ Verification Failed:', err.message);
    } finally {
        await pool.end();
    }
}

verify();
