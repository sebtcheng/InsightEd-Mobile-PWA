import dotenv from 'dotenv';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sql = postgres(process.env.DATABASE_URL, {
    ssl: { rejectUnauthorized: false }, // "require" is implicit in postgres lib usually, but we match loose config
    connect_timeout: 10
});

async function testConnection() {
    console.log("Testing connection with 'postgres' library...");
    try {
        const result = await sql`SELECT version()`;
        console.log("✅ Success!", result[0].version);
    } catch (err) {
        console.error("❌ Failed:", err.message);
        if (err.code) console.error("Code:", err.code);
    } finally {
        await sql.end();
    }
}

testConnection();
