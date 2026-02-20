import fs from 'fs';
import pg from 'pg';

let dbUrl, newDbUrl;

try {
    const raw = fs.readFileSync('.env', 'utf16le'); // Try utf16le
    const lines = raw.split('\r\n');
    for (const line of lines) {
        if (line.startsWith('DATABASE_URL=')) {
            dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
        }
        if (line.startsWith('NEW_DATABASE_URL=')) {
            newDbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
        }
    }
} catch (e) {
    console.error(e);
}

if (!newDbUrl) {
    // Try utf8 fallback
    try {
        const raw = fs.readFileSync('.env', 'utf8');
        const lines = raw.split('\n');
        for (const line of lines) {
            if (line.startsWith('NEW_DATABASE_URL=')) {
                newDbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
            }
        }
    } catch (e) { }
}

console.log("Found NEW_DATABASE_URL:", newDbUrl ? "YES" : "NO");
if (newDbUrl) {
    console.log("Connecting to NEW DB...");
    const { Pool } = pg;
    const pool = new Pool({
        connectionString: newDbUrl,
        ssl: { rejectUnauthorized: false }
    });

    pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
    `).then(res => {
        console.log("Tables in NEW DB:", res.rows.map(r => r.table_name).join(', '));
        pool.end();
    }).catch(e => {
        console.error("Connection Error:", e.message);
        pool.end();
    });
}
