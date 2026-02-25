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
    if (!url) { console.error("No URL"); return; }
    const pool = new Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const region = 'Region II';

        // 1. Total Schools
        const c1 = await pool.query("SELECT COUNT(*) FROM schools WHERE TRIM(region) = $1", [region]);
        const c2 = await pool.query("SELECT COUNT(*) FROM schools WHERE region ILIKE $1", [`%${region}%`]);
        console.log(`Count (TRIM): ${c1.rows[0].count}`);
        console.log(`Count (ILIKE): ${c2.rows[0].count}`);

        // 2. Variations
        const vars = await pool.query("SELECT DISTINCT region FROM schools WHERE region ILIKE '%Region II%'");
        console.log("Variations:", vars.rows);

        // 3. User counts
        const u = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'School Head' AND TRIM(region) = $1", [region]);
        console.log(`Users in Region II: ${u.rows[0].count}`);

    } finally {
        await pool.end();
    }
}
run();
