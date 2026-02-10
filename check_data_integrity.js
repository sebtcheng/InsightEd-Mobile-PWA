
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchoolsData() {
    try {
        const client = await pool.connect();

        console.log("Checking 'schools' table data...");

        // Check count of schools with missing curricular_offering
        const res = await client.query(`
            SELECT count(*) as missing_count 
            FROM schools 
            WHERE curricular_offering IS NULL OR curricular_offering = '';
        `);

        const missingCount = parseInt(res.rows[0].missing_count);
        console.log(`MISSING_COUNT:${missingCount}`);

        client.release();
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkSchoolsData();
