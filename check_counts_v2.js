
import pg from 'pg';
import dotenv from 'dotenv';
import { promisify } from 'util';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkCounts() {
    let client;
    try {
        console.log("Connecting...");
        client = await pool.connect();
        console.log("Connected to DB");

        try {
            console.log("Querying schools count...");
            const resSchools = await client.query('SELECT COUNT(*) FROM schools');
            console.log("Schools Result:", JSON.stringify(resSchools.rows));
        } catch (e) {
            console.log("Error querying schools:", e.message);
        }

        try {
            console.log("Querying school_profiles count...");
            const resProfiles = await client.query('SELECT COUNT(*) FROM school_profiles');
            console.log("Profiles Result:", JSON.stringify(resProfiles.rows));
        } catch (e) {
            console.log("Error querying school_profiles:", e.message);
        }

    } catch (err) {
        console.error("Main Error:", err.message);
    } finally {
        if (client) client.release();
        await pool.end();
        console.log("Pool ended");
    }
}

checkCounts();
