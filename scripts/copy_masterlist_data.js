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

let efdUrl;
try {
    const u = new URL(dbUrl);
    u.pathname = '/efd';
    efdUrl = u.toString();
} catch (e) {
    efdUrl = dbUrl.replace(/\/([^/?]+)(\?|$)/, '/efd$2');
}

const { Pool } = pg;
const localPool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

const efdPool = new Pool({
    connectionString: efdUrl,
    ssl: { rejectUnauthorized: false }
});

async function copy() {
    try {
        console.log("Connecting to EFD...");
        const efdClient = await efdPool.connect();

        console.log("Fetching data from EFD...");
        const res = await efdClient.query('SELECT * FROM masterlist_26_30');
        const rows = res.rows;
        console.log(`Fetched ${rows.length} rows.`);
        efdClient.release();

        if (rows.length === 0) {
            console.log("No data to copy.");
            return;
        }

        console.log("Connecting to Local DB...");
        const localClient = await localPool.connect();

        console.log("Truncating local table...");
        await localClient.query('TRUNCATE TABLE masterlist_26_30');

        // Prepare insert
        const keys = Object.keys(rows[0]);
        const cols = keys.map(k => `"${k}"`).join(',');

        // Batch insert
        const BATCH_SIZE = 1000;
        let inserted = 0;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const values = [];
            const placeholders = [];

            batch.forEach((row, idx) => {
                const rowValues = keys.map(k => row[k]);
                values.push(...rowValues);

                const offset = idx * keys.length;
                const p = Array.from({ length: keys.length }, (_, k) => `$${offset + k + 1}`);
                placeholders.push(`(${p.join(',')})`);
            });

            const query = `INSERT INTO masterlist_26_30 (${cols}) VALUES ${placeholders.join(',')}`;
            await localClient.query(query, values);
            inserted += batch.length;
            console.log(`Inserted ${inserted}/${rows.length}`);
        }

        console.log("✅ Data copy complete!");
        localClient.release();

    } catch (e) {
        console.error("Error copying data:", e);
    } finally {
        await localPool.end();
        await efdPool.end();
    }
}

copy();
