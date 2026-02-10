
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const client = await pool.connect();
        console.log("🔌 Connected to Database");

        // Check columns in 'schools' table
        const query = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'schools';
        `;
        const res = await client.query(query);

        console.log("Table 'schools' columns:");
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

        // Also check if there's any data in it for a random school
        const dataQuery = "SELECT school_id, school_name, curricular_offering FROM schools LIMIT 1";
        try {
            const dataRes = await client.query(dataQuery);
            if (dataRes.rows.length > 0) {
                console.log("\nSample Data:", dataRes.rows[0]);
            }
        } catch (e) {
            console.log("\nCould not fetch sample data (column might be missing):", e.message);
        }

        client.release();
    } catch (err) {
        console.error("❌ Error checking schema:", err.message);
    } finally {
        pool.end();
    }
}

checkSchema();
