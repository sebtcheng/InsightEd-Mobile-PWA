const pg = require('pg');
const { Pool } = pg;

// Use hardcoded local string to be sure, or try env if you prefer
const connectionString = "postgres://postgres:1234@localhost:5432/deped_monitoring_db";

const pool = new Pool({
    connectionString,
    ssl: false
});

const runMigrationAndVerify = async () => {
    console.log("🚀 Starting LGU Schema Verification...");
    try {
        const client = await pool.connect();
        try {
            console.log("🔌 Connected to DB.");

            // 1. Ensure Table Exists
            await client.query(`
              CREATE TABLE IF NOT EXISTS lgu_forms (
                project_id SERIAL PRIMARY KEY,
                project_name TEXT, 
                school_name TEXT, 
                school_id TEXT, 
                region TEXT, 
                division TEXT,
                status TEXT, 
                accomplishment_percentage INTEGER, 
                status_as_of TIMESTAMP,
                target_completion_date TIMESTAMP, 
                actual_completion_date TIMESTAMP, 
                notice_to_proceed TIMESTAMP,
                contractor_name TEXT, 
                project_allocation NUMERIC, 
                batch_of_funds TEXT, 
                other_remarks TEXT,
                lgu_id TEXT, 
                ipc TEXT, 
                lgu_name TEXT, 
                latitude TEXT, 
                longitude TEXT,
                pow_pdf TEXT, 
                dupa_pdf TEXT, 
                contract_pdf TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              );
            `);
            console.log("✅ Table 'lgu_forms' checked/created.");

            // 2. Apply Migration (IDEMPOTENT)
            console.log("🔄 Applying ALTER TABLE migrations...");
            await client.query(`
                ALTER TABLE lgu_forms
                ADD COLUMN IF NOT EXISTS moa_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS tranches_count INTEGER,
                ADD COLUMN IF NOT EXISTS tranche_amount NUMERIC,
                ADD COLUMN IF NOT EXISTS fund_source TEXT,
                ADD COLUMN IF NOT EXISTS province TEXT,
                ADD COLUMN IF NOT EXISTS city TEXT,
                ADD COLUMN IF NOT EXISTS municipality TEXT,
                ADD COLUMN IF NOT EXISTS legislative_district TEXT,
                ADD COLUMN IF NOT EXISTS scope_of_works TEXT,
                ADD COLUMN IF NOT EXISTS contract_amount NUMERIC,
                ADD COLUMN IF NOT EXISTS bid_opening_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS resolution_award_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS procurement_stage TEXT,
                ADD COLUMN IF NOT EXISTS bidding_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS awarding_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS construction_start_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS funds_downloaded NUMERIC,
                ADD COLUMN IF NOT EXISTS funds_utilized NUMERIC;
            `);
            console.log("✅ Migrations applied.");

            // 3. Create Image Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS lgu_image (
                    id SERIAL PRIMARY KEY,
                    project_id INT REFERENCES lgu_forms(project_id),
                    image_data TEXT,
                    uploaded_by TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log("✅ Table 'lgu_image' checked/created.");

            // 4. Verify Columns
            const res = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'lgu_forms'
            `);

            const existing = res.rows.map(r => r.column_name);
            const expected = [
                'moa_date', 'tranches_count', 'tranche_amount', 'fund_source',
                'province', 'city', 'municipality', 'legislative_district',
                'scope_of_works', 'contract_amount', 'bid_opening_date',
                'resolution_award_date', 'procurement_stage', 'bidding_date',
                'awarding_date', 'construction_start_date', 'funds_downloaded',
                'funds_utilized'
            ];

            const missing = expected.filter(e => !existing.includes(e));

            if (missing.length === 0) {
                console.log("\n✨ SUCCESS: ALL LGU COLUMNS VERIFIED!");
            } else {
                console.error("\n❌ ERROR: MISSING COLUMNS:", missing);
            }

        } finally {
            client.release();
        }
    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        await pool.end();
    }
};

runMigrationAndVerify();
