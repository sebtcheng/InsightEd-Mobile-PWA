
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function countSchools() {
    try {
        const client = await pool.connect();
        console.log("🔌 Connected to Database");

        const res = await client.query('SELECT COUNT(*) FROM schools');
        console.log(`📊 Total Schools in DB: ${res.rows[0].count}`);

        // Also check if region column has data
        const regionRes = await client.query('SELECT COUNT(DISTINCT region) FROM schools');
        console.log(`🗺️  Total Unique Regions: ${regionRes.rows[0].count}`);

        client.release();
    } catch (err) {
        console.error("❌ Error counting schools:", err.message);
    } finally {
        pool.end();
    }
}

countSchools();
