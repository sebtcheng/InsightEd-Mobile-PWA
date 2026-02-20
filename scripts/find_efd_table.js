import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Robust .env parsing
let dbUrl = process.env.DATABASE_URL;
let newDbUrl = process.env.NEW_DATABASE_URL;

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

        // Check for NEW_DATABASE_URL
        let matchNew = envContent.match(/NEW_DATABASE_URL=(.+)/);
        if (!matchNew) {
            // try re-reading env content if needed, but it should be same
            matchNew = envContent.match(/NEW_DATABASE_URL=(.+)/);
        }
        if (matchNew) {
            newDbUrl = matchNew[1].trim().replace(/^['"]|['"]$/g, '');
        }

    } catch (e) {
        console.error("Failed to parse .env:", e);
    }
}

const { Pool } = pg;

async function listTables(url, label) {
    if (!url) {
        console.log(`[${label}] No URL found.`);
        return;
    }
    const pool = new Pool({
        connectionString: url,
        ssl: url.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        console.log(`[${label}] Tables:`, res.rows.map(r => r.table_name).join(', '));

        // Specific check for masterlist_26_30
        const check = res.rows.find(r => r.table_name === 'masterlist_26_30');
        if (check) {
            console.log(`✅ [${label}] FOUND 'masterlist_26_30'!`);
        } else {
            console.log(`❌ [${label}] 'masterlist_26_30' NOT FOUND.`);
        }

        client.release();
    } catch (e) {
        console.error(`[${label}] Error:`, e.message);
    } finally {
        await pool.end();
    }
}

async function run() {
    await listTables(dbUrl, 'PRIMARY');
    await listTables(newDbUrl, 'SECONDARY (NEW_DB)');
}

run();
