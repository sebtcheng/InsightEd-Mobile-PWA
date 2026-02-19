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
        const res = await client.query('SELECT COUNT(*) FROM masterlist_26_30');
        console.log(`Local 'masterlist_26_30' rows: ${res.rows[0].count}`);
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
