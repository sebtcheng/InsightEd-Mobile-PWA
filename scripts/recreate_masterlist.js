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
} catch (e) { console.error(e); }

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
    try {
        const client = await pool.connect();

        console.log("Dropping existing table...");
        await client.query('DROP TABLE IF EXISTS masterlist_26_30');

        console.log("Creating table with correct column order...");
        await client.query(`
            CREATE TABLE masterlist_26_30 (
                "Index" integer PRIMARY KEY,
                "congressman" character varying(255),
                "governor" character varying(255),
                "mayor" character varying(255),
                "region" character varying(100),
                "division" character varying(100),
                "school_id" character varying(50),
                "lis_nsbi_school_id_24_25" character varying(50),
                "in_masterlist_with_gov" character varying(50),
                "school_name" text,
                "municipality" character varying(100),
                "leg_district" character varying(100),
                "priority_index" numeric,
                "cl_requirement" integer,
                "estimated_classroom_shortage" integer,
                "no_of_sites" integer,
                "proposed_no_of_classrooms" integer,
                "no_of_unit" integer,
                "sty" integer,
                "cl" integer,
                "proposed_scope_of_work" text,
                "number_of_workshops" text,
                "workshop_types" text,
                "other_design_configurations" text,
                "proposed_funding_year" integer,
                "est_cost_of_classrooms" numeric,
                "project_implementor" character varying(255),
                "cl_sty_ratio" character varying(50)
            );
        `);

        console.log("✅ Table recreated with correct order.");
        client.release();
    } catch (e) {
        console.error("Error recreating table:", e);
    } finally {
        await pool.end();
    }
}
run();
