import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns/promises';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;

async function run() {
    const urlObj = new URL(dbUrl);
    const originalHost = urlObj.hostname;

    console.log(`Resolving ${originalHost}...`);
    try {
        const res = await dns.lookup(originalHost, { family: 4 });
        const ip = res.address;
        console.log(`Resolved to IPv4: ${ip}`);

        // Construct config using IP but keeping SNI
        const config = {
            host: ip,
            port: urlObj.port || 5432,
            database: urlObj.pathname.split('/')[1],
            user: urlObj.username,
            password: urlObj.password,
            ssl: {
                require: true,
                rejectUnauthorized: false,
                servername: originalHost // Critical for Cloud Postgres (Neon)
            },
            connectionTimeoutMillis: 5000
        };

        console.log("Testing connection via IP + SNI...");
        const pool = new Pool(config);

        const client = await pool.connect();
        const r = await client.query('SELECT version()');
        console.log("✅ Success via IP!", r.rows[0].version);
        client.release();
        await pool.end();

    } catch (err) {
        console.error("❌ Failed via IP:", err.message);
        if (err.code) console.error("Code:", err.code);
    }
}

run();
