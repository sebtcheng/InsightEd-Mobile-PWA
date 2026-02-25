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

async function getFullSchema() {
    try {
        const client = await efdPool.connect();
        const res = await client.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale
            FROM information_schema.columns 
            WHERE table_name = 'nsbi_24_25_buildings'
            ORDER BY ordinal_position
        `);

        fs.writeFileSync('source_schema.json', JSON.stringify(res.rows, null, 2), 'utf8');
        console.log("✅ Schema saved to source_schema.json");
        client.release();
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await efdPool.end();
    }
}

getFullSchema();
