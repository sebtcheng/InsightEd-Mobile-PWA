import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;

async function testConfig(name, config) {
    console.log(`\nTesting Config: ${name}`);
    const pool = new Pool(config);
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
        await pool.end();
        return false;
    }
}

async function run() {
    // 1. Loose SSL
    await testConfig('Loose SSL', {
        connectionString: dbUrl,
        ssl: { require: true, rejectUnauthorized: false }
    });

    // 2. KeepAlive + Loose SSL
    await testConfig('KeepAlive + Loose SSL', {
        connectionString: dbUrl,
        ssl: { require: true, rejectUnauthorized: false },
        keepAlive: true
    });

    // 3. No SSL Object (Rely on Connection String params if any)
    // Note: If DB requires SSL and connection string doesn't have it, this fails.
    await testConfig('No SSL Object (String Only)', {
        connectionString: dbUrl
    });

    // 4. Explicit SSL=true (boolean)
    await testConfig('SSL=true', {
        connectionString: dbUrl,
        ssl: true
    });
}

run();
