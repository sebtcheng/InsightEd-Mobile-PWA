
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debug() {
    try {
        const res = await pool.query(`SELECT count(*) FROM schools WHERE leg_district IS NULL OR leg_district = ''`);
        console.log(`Schools with NULL/Empty leg_district: ${res.rows[0].count}`);

        const total = await pool.query(`SELECT count(*) FROM schools`);
        console.log(`Total schools: ${total.rows[0].count}`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

debug();
