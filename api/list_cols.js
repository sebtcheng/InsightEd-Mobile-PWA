import pg from 'pg';
import fs from 'fs';

const envContent = fs.readFileSync('../.env', 'utf8');
const match = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = match ? match[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'masterlist_26_30' ORDER BY ordinal_position");
        console.log(res.rows.map(r => r.column_name).join('\\n'));
    } catch (e) {
        console.error(e.message);
    } finally {
        process.exit(0);
    }
}
run();
