import pg from 'pg';
import fs from 'fs';

// 1. Get current DB URL
let dbUrl;
try {
    const raw = fs.readFileSync('.env');
    // Check BOM
    let content = raw;
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
        content = raw.toString('utf16le');
    } else {
        content = raw.toString('utf8');
    }

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        if (line.startsWith('DATABASE_URL=')) {
            dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
            break;
        }
    }
} catch (e) {
    console.error("Error reading .env:", e);
    process.exit(1);
}

if (!dbUrl) {
    console.error("Could not find DATABASE_URL");
    process.exit(1);
}

console.log("Current DB URL:", dbUrl.replace(/:[^:@]*@/, ':****@'));

// 2. Construct EFD URL (assuming same server)
// URL format: postgres://user:pass@host:port/dbname
// We want to replace the last part (dbname) with 'efd'

let efdUrl;
try {
    const urlObj = new URL(dbUrl);
    // path is /dbname
    urlObj.pathname = '/efd';
    efdUrl = urlObj.toString();
    console.log("Candidate EFD URL:", efdUrl.replace(/:[^:@]*@/, ':****@'));
} catch (e) {
    // Handling non-standard connection strings if necessary, but standard postgres:// works with URL
    console.log("Error parsing URL, trying regex replace...");
    efdUrl = dbUrl.replace(/\/[^/]+$/, '/efd');
    console.log("Candidate EFD URL (Regex):", efdUrl.replace(/:[^:@]*@/, ':****@'));
}

// 3. Test Connection
const { Pool } = pg;
const pool = new Pool({
    connectionString: efdUrl,
    ssl: efdUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log("Connecting to EFD...");
        const client = await pool.connect();
        console.log("✅ Connected to EFD database!");

        // 4. Check for table
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'masterlist_26_30'
        `);

        if (res.rows.length > 0) {
            console.log("✅ Found table 'masterlist_26_30'!");

            // Get count
            const countRes = await client.query('SELECT COUNT(*) FROM masterlist_26_30');
            console.log(`Rows in 'masterlist_26_30': ${countRes.rows[0].count}`);

            // Get column info to help with cloning
            const cols = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'masterlist_26_30'
            `);
            console.log("Columns:", cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

        } else {
            console.log("❌ Table 'masterlist_26_30' NOT found in EFD.");
            // List all tables just in case
            const all = await client.query(`
                SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
            `);
            console.log("Available tables:", all.rows.map(r => r.table_name).join(', '));
        }

        client.release();
    } catch (e) {
        console.error("❌ Connection Failed:", e.message);
        if (e.message.includes('database "efd" does not exist')) {
            console.log("Suggestion: The database name might be different. Please check pgAdmin/your tool for the exact name.");
        }
    } finally {
        await pool.end();
    }
}

check();
