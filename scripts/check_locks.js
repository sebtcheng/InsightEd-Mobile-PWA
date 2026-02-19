import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Robust .env parsing
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
        console.error("Failed to parse .env:", e);
    }
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function check() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT pid, state, query, age(clock_timestamp(), query_start) as duration 
            FROM pg_stat_activity 
            WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
        `);
        console.log("Active Queries:", JSON.stringify(res.rows, null, 2));

        const locks = await client.query(`
            SELECT t.relname, l.mode, l.granted, a.query, a.pid
            FROM pg_locks l
            JOIN pg_stat_activity a ON l.pid = a.pid
            JOIN pg_class t ON l.relation = t.oid
            WHERE t.relname = 'psip'
        `);
        console.log("Locks on 'psip':", JSON.stringify(locks.rows, null, 2));

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
