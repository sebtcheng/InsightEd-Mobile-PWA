import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Robust .env parsing (copied from api/index.js to ensure connection)
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

const createTableQuery = `
DROP TABLE IF EXISTS psip;

CREATE TABLE psip (
    id SERIAL PRIMARY KEY,
    congressman TEXT,
    governor TEXT,
    mayor TEXT,
    region TEXT,
    division TEXT,
    school_id INTEGER,
    lis_school_id INTEGER,
    in_masterlist_with_gov INTEGER,
    school_name TEXT,
    municipality TEXT,
    leg_district TEXT,
    priority_index NUMERIC,
    cl_requirement INTEGER,
    est_classroom_shortage INTEGER,
    no_of_sites INTEGER,
    proposed_no_of_classrooms INTEGER,
    no_of_unit INTEGER,
    sty INTEGER,
    cl INTEGER,
    proposed_scope_of_work TEXT,
    number_of_workshops INTEGER,
    workshop_types TEXT,
    other_design_configs TEXT,
    proposed_funding_year INTEGER,
    est_cost_of_classrooms NUMERIC,
    project_implementor TEXT,
    cl_sty INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function createTable() {
    try {
        console.log("Connecting to database...");
        const client = await pool.connect();
        console.log("Connected. Creating 'psip' table...");
        await client.query(createTableQuery);
        console.log("✅ Table 'psip' created successfully.");
        client.release();
    } catch (err) {
        console.error("❌ Error creating table:", err);
    } finally {
        await pool.end();
    }
}

createTable();
