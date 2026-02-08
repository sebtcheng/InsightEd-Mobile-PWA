import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    console.log('🔍 Inspecting schools table columns...');
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'schools'");
        console.log(res.rows.map(r => r.column_name).sort());
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

inspect();
