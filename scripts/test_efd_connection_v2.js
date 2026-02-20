import pg from 'pg';
import fs from 'fs';

// 1. Get current DB URL with robust parsing
let dbUrl;
try {
    const raw = fs.readFileSync('.env');
    let content;

    // Check BOM for UTF-16LE
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
        content = raw.toString('utf16le');
    } else {
        content = raw.toString('utf8'); // Default fallback
    }

    // Parse line by line to handle different EOLs
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        if (line.trim().startsWith('DATABASE_URL=')) {
            dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
            break;
        }
    }
} catch (e) {
    console.error("Error reading .env:", e);
    process.exit(1);
}

if (!dbUrl) {
    console.error("Could not find DATABASE_URL in .env");
    process.exit(1);
}

console.log("Current DB URL:", dbUrl.replace(/:[^:@]*@/, ':****@'));

// 2. Construct EFD URL
// We replace the database name at the end of the connection string
// Typical format: postgres://user:pass@host:port/dbname
// or postgres://host:port/dbname?sslmode=...

let efdUrl = dbUrl;
try {
    // Basic replacement: find last /dbname and replace or pathname via URL
    // If it's a valid URI
    const u = new URL(dbUrl);
    u.pathname = '/efd';
    efdUrl = u.toString();
} catch (e) {
    // If URL parsing fails (e.g. some Azure formats), try regex
    efdUrl = dbUrl.replace(/\/([^/?]+)(\?|$)/, '/efd$2');
}

console.log("Candidate EFD URL:", efdUrl.replace(/:[^:@]*@/, ':****@'));


// 3. Test Connection
const { Pool } = pg;
const pool = new Pool({
    connectionString: efdUrl,
    ssl: { rejectUnauthorized: false } // Azure often requires SSL
});

async function check() {
    try {
        console.log("Connecting to EFD...");
        const client = await pool.connect();
        console.log("✅ Connected to EFD database!");

        // 4. Check for table 'masterlist_26_30'
        console.log("Checking for table 'masterlist_26_30'...");
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'masterlist_26_30'
        `);

        if (res.rows.length > 0) {
            console.log("✅ Found table 'masterlist_26_30'!");

            // Get row count
            const countRes = await client.query('SELECT COUNT(*) FROM masterlist_26_30');
            console.log(`Rows: ${countRes.rows[0].count}`);

            // Get columns to help with CREATE TABLE
            const cols = await client.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns 
                WHERE table_name = 'masterlist_26_30'
            `);
            console.log("Columns:", JSON.stringify(cols.rows, null, 2));

        } else {
            console.log("❌ Table 'masterlist_26_30' NOT found in EFD.");
            // List available tables
            const all = await client.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            console.log("Available tables:", all.rows.map(r => r.table_name).join(', '));
        }

        client.release();
    } catch (e) {
        console.error("❌ Connection Failed:", e.message);
        if (e.message.includes('password authentication failed')) {
            console.log("Note: It's possible EFD uses different credentials.");
        }
    } finally {
        await pool.end();
    }
}

check();
