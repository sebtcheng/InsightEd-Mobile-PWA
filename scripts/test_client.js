import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Client } = pg;

async function testSingleClient() {
    console.log("Testing Single Client Connection...");

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            require: true,
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 10000
    });

    try {
        await client.connect();
        const res = await client.query('SELECT version()');
        console.log("✅ Success! Version:", res.rows[0].version);
        await client.end();
    } catch (err) {
        console.error("❌ Client Failed:", err.message);
        if (err.message.includes('ECONNRESET')) {
            console.error("   (Shutdown by peer immediately)");
        }
    }
}

testSingleClient();
