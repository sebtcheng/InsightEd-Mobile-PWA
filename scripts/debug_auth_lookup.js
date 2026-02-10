
import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const checkSchoolId = async (schoolId) => {
    try {
        const result = {
            schoolId: schoolId,
            users_table: [],
            school_profiles_table: []
        };

        // Check users table
        const usersRes = await pool.query(
            "SELECT uid, email, role FROM users WHERE email LIKE $1 OR email LIKE $2",
            [`${schoolId}@insighted.app`, `${schoolId}@deped.gov.ph`]
        );
        result.users_table = usersRes.rows;

        // Check school_profiles table
        const spRes = await pool.query(
            "SELECT school_id, school_name, email, submitted_by FROM school_profiles WHERE school_id = $1",
            [schoolId]
        );
        result.school_profiles_table = spRes.rows;

        console.log(JSON.stringify(result, null, 2));

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        await pool.end();
    }
};

checkSchoolId('300425');
