import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const debugData = async () => {
    try {
        console.log("--- DEBUGGING DATA ---");

        // 1. Search for the School Profile
        const schoolRes = await pool.query(`SELECT school_id, school_name, submitted_by FROM school_profiles WHERE school_name ILIKE '%Cabayo Primary%'`);
        console.log("School Profile Record:", schoolRes.rows);

        if (schoolRes.rows.length > 0) {
            const schoolId = schoolRes.rows[0].school_id;

            // 2. Search for Users linked to this School ID
            const userRes = await pool.query(`SELECT uid, email, first_name, last_name, school_id FROM users WHERE school_id = $1`, [schoolId]);
            console.log("Users with this school_id:", userRes.rows);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
};

debugData();
