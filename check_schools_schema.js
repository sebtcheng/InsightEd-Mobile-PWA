
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const client = await pool.connect();

        console.log("Connected to DB");

        // Check columns in 'schools' table
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'schools';
        `);

        console.log("Columns in 'schools' table:");
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

        // Check if curricular_offering exists
        const hasColumn = res.rows.some(r => r.column_name === 'curricular_offering');
        console.log(`\nHas curricular_offering column: ${hasColumn}`);

        if (hasColumn) {
            // Check a summary of data
            const dataRes = await client.query(`SELECT school_id, curricular_offering FROM schools LIMIT 5`);
            console.log("\nSample data (curricular_offering):");
            console.log(dataRes.rows);
        }

        client.release();
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
