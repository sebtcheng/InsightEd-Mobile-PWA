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

        // 2. Check Sample
        if (res.rows[0].count > 0) {
            const sample = await client.query('SELECT * FROM masterlist_26_30 LIMIT 1');
            console.log("Sample Row:", JSON.stringify(sample.rows[0], null, 2));
        }

        // 3. Check Constraints (PK)
        const constraints = await client.query(`
            SELECT conname, contype 
            FROM pg_constraint 
            WHERE conrelid = 'masterlist_26_30'::regclass
        `);
        console.log("Constraints:", constraints.rows);

        // 4. Check Unique Index
        const distinctIndex = await client.query('SELECT COUNT(DISTINCT "Index") as d, COUNT(*) as t FROM masterlist_26_30');
        console.log(`Distinct Index: ${distinctIndex.rows[0].d}, Total: ${distinctIndex.rows[0].t}`);

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
