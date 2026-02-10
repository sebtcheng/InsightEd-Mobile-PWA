
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkOfferings() {
    try {
        const client = await pool.connect();
        const query = "SELECT DISTINCT curricular_offering FROM schools ORDER BY curricular_offering";
        const res = await client.query(query);

        console.log("Distinct Curricular Offerings:");
        res.rows.forEach(r => console.log(`- '${r.curricular_offering}'`));

        client.release();
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        pool.end();
    }
}

checkOfferings();
