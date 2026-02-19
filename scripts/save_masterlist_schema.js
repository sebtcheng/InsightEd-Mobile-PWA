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
    u.pathname = '/efd';
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
        const cols = await client.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'masterlist_26_30'
            ORDER BY ordinal_position
        `);

        fs.writeFileSync('masterlist_schema.json', JSON.stringify(cols.rows, null, 2));
        console.log("Schema saved to masterlist_schema.json");
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
