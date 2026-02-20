import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    const schoolId = '301898';
    console.log('--- START DEBUG ---');
    console.log(`Checking School: ${schoolId}`);

    try {
        // 1. Check School Profile
        const res = await pool.query('SELECT school_id, school_name, submitted_by, email FROM school_profiles WHERE school_id = $1', [schoolId]);
        if (res.rows.length === 0) {
            console.log('SCHOOL NOT FOUND');
        } else {
            console.log('SCHOOL FOUND');
            console.log('School Details: ' + JSON.stringify(res.rows[0]));
            const submittedBy = res.rows[0].submitted_by;

            if (submittedBy) {
                // 2. Check User by UID
                const userRes = await pool.query('SELECT uid, email, role FROM users WHERE uid = $1', [submittedBy]);
                if (userRes.rows.length > 0) {
                    console.log('OWNER USER FOUND: ' + JSON.stringify(userRes.rows[0]));
                } else {
                    console.log('OWNER USER NOT FOUND (UID mismatch) with UID: ' + submittedBy);
                }
            } else {
                console.log('SCHOOL HAS NO OWNER (submitted_by is null)');
            }
        }

        // 3. Check for @deped.gov.ph user
        const email = `${schoolId}@deped.gov.ph`;
        const uRes = await pool.query('SELECT uid, email, role FROM users WHERE email = $1', [email]);
        if (uRes.rows.length > 0) {
            console.log(`DEPED USER FOUND: ` + JSON.stringify(uRes.rows[0]));
        } else {
            console.log(`DEPED USER NOT FOUND`);
        }

    } catch (err) {
        console.error("Query Error:", err);
    } finally {
        console.log('--- END DEBUG ---');
        pool.end();
    }
}

check();
