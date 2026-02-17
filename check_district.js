
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
        const res = await pool.query(`SELECT count(*) FROM schools WHERE district IS NOT NULL AND district != ''`);
        console.log(`Schools with populated district: ${res.rows[0].count}`);
    } catch (err) {
        console.log("Error (probably column missing):", err.message);
    } finally {
        pool.end();
    }
}

debug();
