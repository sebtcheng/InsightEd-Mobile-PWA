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
} catch (e) {
    console.error("Error reading .env:", e);
    process.exit(1);
}

let efdUrl;
try {
    const u = new URL(dbUrl);
    u.pathname = '/efd'; // Switch to EFD
    efdUrl = u.toString();
} catch (e) {
    efdUrl = dbUrl.replace(/\/([^/?]+)(\?|$)/, '/efd$2');
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: efdUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT COUNT(*) as total, COUNT(DISTINCT "Index") as distinct_idx FROM masterlist_26_30');
        console.log(`Total: ${res.rows[0].total}, Distinct Index: ${res.rows[0].distinct_idx}`);

        if (res.rows[0].total === res.rows[0].distinct_idx) {
            console.log("✅ 'Index' is UNIQUE.");
        } else {
            console.log("❌ 'Index' is NOT unique.");
        }
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
