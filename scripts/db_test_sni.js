import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;

// Disable TLS validation globally for this test
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testUrl(name, urlString) {
    console.log(`\nTesting URL: ${name}`);
    console.log(`Generic Host: ${new URL(urlString).hostname}`);

    const pool = new Pool({
        connectionString: urlString,
        ssl: true, // We already disabled auth validation globally, but ssl=true is needed to trigger SSL
        connectionTimeoutMillis: 10000
    });

    try {
        const client = await pool.connect();
        const res = await client.query('SELECT version()');
        console.log(`✅ Success with [${name}]!`);
        console.log(`   Version: ${res.rows[0].version.substring(0, 40)}...`);
        client.release();
        await pool.end();
        return true;
    } catch (err) {
        console.error(`❌ Failed [${name}]:`, err.message);
        if (err.message.includes('ECONNRESET')) {
            console.error("   (Server hung up)");
        }
        await pool.end();
        return false;
    }
}

async function run() {
    // 1. Original
    await testUrl('Original (Pooler?)', dbUrl);

    // 2. Try to derive direct connection
    // Remove "-pooler" from hostname if present
    try {
        const urlObj = new URL(dbUrl);
        if (urlObj.hostname.includes('-pooler')) {
            const originalHost = urlObj.hostname;
            const newHost = originalHost.replace('-pooler', '');
            urlObj.hostname = newHost;
            const directUrl = urlObj.toString();

            console.log("\nFound pooler URL, attempting direct connection...");
            await testUrl('Derived Direct Connection', directUrl);
        } else {
            console.log("\nURL does not appear to be a pooler URL (no '-pooler' in hostname).");
        }
    } catch (e) {
        console.error("Error parsing URL:", e);
    }
}

run();
