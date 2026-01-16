
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const reset = async () => {
    try {
        await pool.query("UPDATE engineer_form SET validation_status = 'Pending'");
        console.log("Successfully reset all projects to Pending.");
    } catch (err) {
        console.error("Reset failed:", err);
    } finally {
        pool.end();
    }
};

reset();
