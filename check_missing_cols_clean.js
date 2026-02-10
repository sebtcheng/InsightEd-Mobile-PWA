
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'engineer_form';
        `);

        const cols = res.rows.map(r => r.column_name);
        // console.log("Cols:", cols); 

        const needed = [
            'number_of_classrooms',
            'number_of_sites',
            'number_of_storeys',
            'funds_utilized'
        ];

        const missing = needed.filter(c => !cols.includes(c));

        if (missing.length === 0) {
            console.log("VERIFICATION_SUCCESS: All columns are present.");
        } else {
            console.log("VERIFICATION_FAILED: Missing: " + missing.join(", "));
        }

        client.release();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

check();
