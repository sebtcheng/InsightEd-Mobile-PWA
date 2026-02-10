
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkRegions() {
    try {
        const client = await pool.connect();
        console.log("🔌 Connected to Database");

        const query = "SELECT DISTINCT region FROM schools WHERE region IS NOT NULL AND region != '' ORDER BY region ASC";
        console.log(`running query: ${query}`);
        const res = await client.query(query);

        console.log(`✅ Query successful. Rows returned: ${res.rows.length}`);
        if (res.rows.length > 0) {
            console.log("First 5 regions:", res.rows.slice(0, 5).map(r => r.region));
        } else {
            console.log("⚠️ No regions found!");
        }

        client.release();
    } catch (err) {
        console.error("❌ Error querying regions:", err.message);
    } finally {
        pool.end();
    }
}

checkRegions();
