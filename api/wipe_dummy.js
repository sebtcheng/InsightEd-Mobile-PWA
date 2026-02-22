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
        console.log('🧹 Wiping dummy partnership data...');

        await pool.query(`
            UPDATE masterlist_26_30 
            SET 
                prov_implemented = false,
                muni_implemented = false,
                city_implemented = false,
                dpwh_implemented = false,
                deped_implemented = false,
                cso_ngo_implemented = false,
                resolved_partnership = NULL;
        `);

        console.log('✅ All dummy partnership flags and resolutions have been cleared from masterlist_26_30.');
    } catch (err) {
        console.error('❌ Error wiping dummy data:', err);
    } finally {
        pool.end();
    }
}

run();
