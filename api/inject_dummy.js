import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
    try {
        let envContent = fs.readFileSync('.env', 'utf16le');
        let match = envContent.match(/DATABASE_URL=(.+)/);
        if (!match) {
            envContent = fs.readFileSync('.env', 'utf8');
            match = envContent.match(/DATABASE_URL=(.+)/);
        }
        if (match) {
            dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
        }
    } catch (e) {
        console.error("⚠️ Failed to manually parse .env:", e.message);
    }
}

const { Pool } = pg;
const isLocal = dbUrl && (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'));
const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query('SELECT school_id FROM masterlist_26_30 LIMIT 13');
        const ids = res.rows.map(r => r.school_id);

        if (ids.length < 13) {
            console.warn('Not enough rows in masterlist_26_30 for full testing, applying available.');
        }

        const qs = (slice) => slice.map(v => `'${v}'`).join(',');

        // Reset resolved flags for tests
        await pool.query(`UPDATE masterlist_26_30 SET resolved_partnership = NULL;`);

        if (ids.length >= 3) await pool.query(`UPDATE masterlist_26_30 SET prov_implemented = true WHERE school_id IN (${qs(ids.slice(0, 3))});`);
        if (ids.length >= 5) await pool.query(`UPDATE masterlist_26_30 SET muni_implemented = true WHERE school_id IN (${qs(ids.slice(3, 5))});`);
        if (ids.length >= 6) await pool.query(`UPDATE masterlist_26_30 SET city_implemented = true WHERE school_id = '${ids[5]}';`);

        // OVERLAP SECTION (For Decision Testing)
        if (ids.length >= 10) await pool.query(`UPDATE masterlist_26_30 SET dpwh_implemented = true WHERE school_id IN (${qs(ids.slice(0, 4))});`); // Overlaps with the first 3 providers
        if (ids.length >= 12) await pool.query(`UPDATE masterlist_26_30 SET deped_implemented = true WHERE school_id IN (${qs(ids.slice(10, 12))});`);
        if (ids.length >= 13) await pool.query(`UPDATE masterlist_26_30 SET cso_ngo_implemented = true WHERE school_id = '${ids[12]}';`);

        console.log('✅ Dummy boolean flags successfully injected matching real school IDs! Please check the dashboard.');
    } catch (err) {
        console.error('❌ Error updating DB:', err);
    } finally {
        pool.end();
    }
}

run();
