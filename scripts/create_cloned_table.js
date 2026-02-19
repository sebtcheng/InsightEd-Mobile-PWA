import pg from 'pg';
import fs from 'fs';

// 1. Get current DB URL
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

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

const schema = JSON.parse(fs.readFileSync('masterlist_schema.json', 'utf8'));

// Build CREATE TABLE query
// We need to map types. Most PG types map directly.
// id usually serial, but here we clone structure. If successful, we can just use same types.

const cols = schema.map(c => {
    let type = c.data_type;
    if (c.character_maximum_length) {
        type += `(${c.character_maximum_length})`;
    }
    // Handle specific types if needed
    if (type === 'character varying') type = 'VARCHAR'; // Alias

    // Add validation? No, trust source.
    return `"${c.column_name}" ${type}`;
});

const createQuery = `
    DROP TABLE IF EXISTS masterlist_26_30;
    CREATE TABLE masterlist_26_30 (
        ${cols.join(',\n        ')}
    );
`;

console.log("Create Query:", createQuery);

async function run() {
    try {
        const client = await pool.connect();
        await client.query(createQuery);
        console.log("✅ Table 'masterlist_26_30' created in INSIGHTED DB.");
        client.release();
    } catch (e) {
        console.error("Error creating table:", e);
    } finally {
        await pool.end();
    }
}

run();
