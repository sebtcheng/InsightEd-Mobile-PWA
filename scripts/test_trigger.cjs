const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testTrigger() {
    const client = await pool.connect();
    try {
        console.log("🧪 Testing Trigger Synchronization...");

        // 1. Pick a random school to test
        const res = await client.query('SELECT school_id, total_enrollment FROM school_profiles LIMIT 1');
        const school = res.rows[0];
        const schoolId = school.school_id;
        const originalVal = school.total_enrollment;
        const newVal = 999999;

        console.log(`Target School: ${schoolId}, Original Enrollment: ${originalVal}`);

        // 2. Update school_profiles
        console.log(`📝 Updating school_profiles set total_enrollment = ${newVal}...`);
        await client.query('UPDATE school_profiles SET total_enrollment = $1 WHERE school_id = $2', [newVal, schoolId]);

        // 3. Check form_enrollment
        console.log("👀 Checking form_enrollment...");
        const checkRes = await client.query('SELECT total_enrollment FROM form_enrollment WHERE school_id = $1', [schoolId]);
        const syncedVal = checkRes.rows[0]?.total_enrollment;

        if (String(syncedVal) === String(newVal)) {
            console.log(`✅ SUCCESS! form_enrollment updated to ${syncedVal}`);
        } else {
            console.error(`❌ FAILURE! form_enrollment is ${syncedVal}, expected ${newVal}`);
        }

        // 4. Revert
        console.log("Reverting changes...");
        await client.query('UPDATE school_profiles SET total_enrollment = $1 WHERE school_id = $2', [originalVal, schoolId]);
        console.log("Revert complete.");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

testTrigger();
