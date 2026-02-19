import pg from 'pg';
import fs from 'fs';

let dbUrl;
try {
    const raw = fs.readFileSync('.env');
    let content;
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
        content = raw.toString('utf16le');
    } else {
        content = raw.toString('utf8');
    }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        if (line.trim().startsWith('DATABASE_URL=')) {
            dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
            break;
        }
    }
} catch (e) { console.error(e); }

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
    try {
        const client = await pool.connect();

        // 1. Check Row Count
        const res = await client.query('SELECT COUNT(*) FROM masterlist_26_30');
        console.log(`Rows in 'masterlist_26_30': ${res.rows[0].count}`);

        // 2. Check Column Order
        const cols = await client.query(`
            SELECT column_name, ordinal_position
            FROM information_schema.columns 
            WHERE table_name = 'masterlist_26_30'
            ORDER BY ordinal_position
            LIMIT 5
        `);
        console.log("First 5 columns:");
        cols.rows.forEach(r => console.log(`${r.ordinal_position}: ${r.column_name}`));

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
