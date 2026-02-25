import pg from 'pg';
import fs from 'fs';

let dbUrl;
try {
    const raw = fs.readFileSync('.env');
    let content;
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
        content = raw.toString('utf16le');
    } else {
        content = raw.toString('utf8');
    }
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

let efdUrl;
try {
    const u = new URL(dbUrl);
    u.pathname = '/efd';
    efdUrl = u.toString();
} catch (e) {
    efdUrl = dbUrl.replace(/\/([^/?]+)(\?|$)/, '/efd$2');
}

const { Pool } = pg;
const efdPool = new Pool({
    connectionString: efdUrl,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    try {
        console.log("Connecting to EFD...");
        const client = await efdPool.connect();

        console.log("Checking table 'nsbi_24_25_buildings'...");
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'nsbi_24_25_buildings'
            ORDER BY ordinal_position
        `);

        if (res.rows.length === 0) {
            console.log("❌ Table 'nsbi_24_25_buildings' NOT found in EFD.");
            const all = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            console.log("Available tables:", all.rows.map(r => r.table_name).join(', '));
        } else {
            console.log("✅ Found table 'nsbi_24_25_buildings'!");
            console.log("Columns:");
            res.rows.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type})`);
            });

            const countRes = await client.query('SELECT COUNT(*) FROM nsbi_24_25_buildings');
            console.log(`\nTotal rows: ${countRes.rows[0].count}`);
        }

        client.release();
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await efdPool.end();
    }
}

inspect();
