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

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function check() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'nsbi_24_25_buildings'
        `);

        if (res.rows.length > 0) {
            console.log("⚠️ Table 'nsbi_24_25_buildings' already exists in insighted.");
        } else {
            console.log("✅ Table 'nsbi_24_25_buildings' does NOT exist in insighted.");
        }
        client.release();
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

check();
