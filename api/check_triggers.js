import pg from 'pg';
import fs from 'fs';

const envContent = fs.readFileSync('../.env', 'utf8');
const match = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = match ? match[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const resFunc = await pool.query(`SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE proname ILIKE '%update%' OR prosrc ILIKE '%data_health_score%'`);
        resFunc.rows.forEach(r => {
            if (r.pg_get_functiondef.includes('data_health_score')) {
                console.log(r.proname, "\n", r.pg_get_functiondef.substring(0, 500));
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
