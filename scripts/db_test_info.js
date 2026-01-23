import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log("Environment Info:");
console.log("Node:", process.version);
console.log("OpenSSL:", process.versions.openssl);
console.log("V8:", process.versions.v8);

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;

async function testTLS(name, sslConfig) {
    console.log(`\nTesting Config: ${name}`);
    const pool = new Pool({
        connectionString: dbUrl,
        ssl: sslConfig,
        connectionTimeoutMillis: 5000
    });

    try {
        const client = await pool.connect();
        const res = await client.query('SELECT version()');
        console.log(`✅ Success with [${name}]!`);
        client.release();
    } catch (err) {
        console.error(`❌ Failed [${name}]:`, err.message);
        if (err.code) console.error("   Code:", err.code);
    } finally {
        await pool.end();
    }
}

async function run() {
    // Force TLS 1.2
    await testTLS('Force TLSv1.2', {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.2'
    });

    // Relaxed with no specific version
    await testTLS('Relaxed default', {
        rejectUnauthorized: false
    });
}

run();
