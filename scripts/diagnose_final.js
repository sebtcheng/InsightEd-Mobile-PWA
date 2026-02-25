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
    return match ? match[1].trim().replace(/^[\'\"]|[\'\"]$/g, '') : null;
}

async function run() {
    const url = getDbUrl();
    if (!url) { console.error("No URL"); return; }
    const pool = new Pool({ connectionString: url });

    try {
        console.log("1. Checking for duplicate school_ids in Schools table...");
        const sDupes = await pool.query("SELECT school_id, COUNT(*) FROM schools GROUP BY school_id HAVING COUNT(*) > 1");
        console.log("Duplicate School IDs in 'schools':", sDupes.rows);

        console.log("2. Checking for duplicate school_ids in school_profiles...");
        const pDupes = await pool.query("SELECT school_id, COUNT(*) FROM school_profiles GROUP BY school_id HAVING COUNT(*) > 1");
        console.log("Duplicate School IDs in 'school_profiles':", pDupes.rows);

        console.log("3. Region II Variations...");
        const variations = await pool.query("SELECT DISTINCT region FROM schools WHERE region ILIKE '%Region II%'");
        console.log("Region II variations:", variations.rows);

        console.log("4. User counts for Region II...");
        const uCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'School Head' AND region ILIKE '%Region II%'");
        console.log("School Heads in Region II (ILIKE):", uCount.rows[0].count);

    } finally {
        await pool.end();
    }
}
run();
