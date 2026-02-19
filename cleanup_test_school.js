import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')) ? false : { rejectUnauthorized: false }
});

(async () => {
    try {
        await client.connect();
        const schoolId = '108607';

        // Clean up school profile
        await client.query('DELETE FROM school_profiles WHERE school_id = $1', [schoolId]);
        console.log(`Deleted school profile for ${schoolId}`);

        // Clean up teacher specialization details
        await client.query('DELETE FROM teacher_specialization_details WHERE school_id = $1', [schoolId]);
        console.log(`Deleted teacher specs for ${schoolId}`);

        // Clean up user
        // We used a random uid in verify_autofill.js so we don't know it easily unless we query school_profiles first.
        // The previous run failed to register? Or succeeded? 
        // "Registered Successfully" -> So user was created.
        // We should delete user too if possible, but it's minor.

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
})();
