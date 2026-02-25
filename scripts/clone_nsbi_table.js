import pg from 'pg';
import fs from 'fs';

// 1. Get DB URLs
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

if (!dbUrl) {
    console.error("DATABASE_URL not found in .env");
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
const insightedPool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

const efdPool = new Pool({
    connectionString: efdUrl,
    ssl: { rejectUnauthorized: false }
});

async function clone() {
    try {
        console.log("Connecting to databases...");
        const efdClient = await efdPool.connect();
        const insightedClient = await insightedPool.connect();

        // 2. Create table in insighted
        console.log("Preparing table schema...");
        const schema = JSON.parse(fs.readFileSync('source_schema.json', 'utf8'));

        const colDefs = schema.map(c => {
            let type = c.data_type;
            if (c.character_maximum_length) {
                type += `(${c.character_maximum_length})`;
            } else if (c.numeric_precision && type === 'numeric') {
                type += `(${c.numeric_precision},${c.numeric_scale})`;
            }

            // Map character varying to VARCHAR for better compatibility if needed, 
            // but PG handles "character varying" fine.

            const nullable = c.is_nullable === 'NO' ? 'NOT NULL' : '';
            return `"${c.column_name}" ${type} ${nullable}`;
        });

        const createQuery = `
            DROP TABLE IF EXISTS nsbi_24_25_buildings;
            CREATE TABLE nsbi_24_25_buildings (
                ${colDefs.join(',\n                ')}
            );
        `;

        console.log("Creating table 'nsbi_24_25_buildings' in insighted...");
        await insightedClient.query(createQuery);
        console.log("✅ Table created.");

        // 3. Fetch and Copy Data in Batches
        console.log("Starting data transfer...");
        const totalRowsRes = await efdClient.query('SELECT COUNT(*) FROM nsbi_24_25_buildings');
        const totalRows = parseInt(totalRowsRes.rows[0].count);
        console.log(`Total rows to copy: ${totalRows}`);

        const BATCH_SIZE = 2000;
        const keys = schema.map(c => c.column_name);
        const colsStr = keys.map(k => `"${k}"`).join(',');

        for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
            console.log(`Fetching batch ${offset} to ${offset + BATCH_SIZE}...`);
            const res = await efdClient.query(`SELECT * FROM nsbi_24_25_buildings LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
            const rows = res.rows;

            if (rows.length === 0) break;

            const values = [];
            const placeholders = [];

            rows.forEach((row, rowIdx) => {
                const rowValues = keys.map(k => row[k]);
                values.push(...rowValues);

                const startIdx = rowIdx * keys.length + 1;
                const p = Array.from({ length: keys.length }, (_, k) => `$${startIdx + k}`);
                placeholders.push(`(${p.join(',')})`);
            });

            const insertQuery = `INSERT INTO nsbi_24_25_buildings (${colsStr}) VALUES ${placeholders.join(',')}`;
            await insightedClient.query(insertQuery, values);
            console.log(`✅ Copied ${offset + rows.length}/${totalRows} rows.`);
        }

        console.log("⭐⭐⭐ Data cloning complete! ⭐⭐⭐");

        efdClient.release();
        insightedClient.release();
    } catch (e) {
        console.error("❌ Error during cloning:", e);
    } finally {
        await efdPool.end();
        await insightedPool.end();
    }
}

clone();
