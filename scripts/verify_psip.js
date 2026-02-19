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

if (!dbUrl) {
    console.error("DATABASE_URL not found!");
    process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function verify() {
    try {
        const client = await pool.connect();

        const countRes = await client.query('SELECT COUNT(*) FROM psip');
        console.log(`Total rows in 'psip': ${countRes.rows[0].count}`);

        const sampleRes = await client.query('SELECT * FROM psip LIMIT 1');
        if (sampleRes.rows.length > 0) {
            console.log("Sample row:", JSON.stringify(sampleRes.rows[0], null, 2));
        } else {
            console.log("Table is empty.");
        }

        client.release();
    } catch (err) {
        console.error("Error verifying:", err);
    } finally {
        await pool.end();
    }
}

verify();
