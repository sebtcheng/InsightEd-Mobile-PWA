import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';

function getDbUrl() {
    if (!fs.existsSync('.env')) return null;
    let content = fs.readFileSync('.env', 'utf8');
    let match = content.match(/DATABASE_URL=(.+)/);
    if (!match) {
        content = fs.readFileSync('.env', 'utf16le');
        match = content.match(/DATABASE_URL=(.+)/);
    }
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

async function run() {
    const url = getDbUrl();
    if (!url) return;
    const pool = new Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const res = await pool.query("SELECT school_id, COUNT(*) FROM schools GROUP BY school_id HAVING COUNT(*) > 1 LIMIT 10");
        console.log("Duplicate schools:", res.rows);
    } finally {
        await pool.end();
    }
}
run();
