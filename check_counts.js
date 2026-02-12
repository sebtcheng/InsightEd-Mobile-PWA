
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkCounts() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB");

        try {
            const resSchools = await client.query('SELECT COUNT(*) FROM schools');
            console.log(`Count in 'schools': ${resSchools.rows[0].count}`);
        } catch (e) {
            console.log("Error querying schools:", e.message);
        }

        try {
            const resProfiles = await client.query('SELECT COUNT(*) FROM school_profiles');
            console.log(`Count in 'school_profiles': ${resProfiles.rows[0].count}`);
        } catch (e) {
            console.log("Error querying school_profiles:", e.message);
        }

        client.release();
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkCounts();
