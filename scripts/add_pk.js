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

        console.log("Checking if PK exists...");
        const res = await client.query(`
            SELECT conname FROM pg_constraint WHERE conrelid = 'masterlist_26_30'::regclass AND contype = 'p';
        `);

        if (res.rows.length > 0) {
            console.log("PK already exists:", res.rows[0].conname);
        } else {
            console.log("Adding Primary Key on 'Index'...");
            await client.query('ALTER TABLE masterlist_26_30 ADD PRIMARY KEY ("Index");');
            console.log("✅ Primary Key added successfully.");
        }

        client.release();
    } catch (e) {
        console.error("Error adding PK:", e);
    } finally {
        await pool.end();
    }
}
run();
