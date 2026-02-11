
import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting...");
        const client = await pool.connect();

        const table = 'lgu_forms';
        const columns = [
            { name: 'source_agency', type: 'TEXT' },
            { name: 'lsb_resolution_no', type: 'TEXT' },
            { name: 'moa_ref_no', type: 'TEXT' },
            { name: 'validity_period', type: 'TEXT' },
            { name: 'contract_duration', type: 'TEXT' },
            { name: 'date_approved_pow', type: 'DATE' },
            { name: 'fund_release_schedule', type: 'TEXT' },
            { name: 'mode_of_procurement', type: 'TEXT' },
            { name: 'philgeps_ref_no', type: 'TEXT' },
            { name: 'pcab_license_no', type: 'TEXT' },
            { name: 'date_contract_signing', type: 'DATE' },
            { name: 'bid_amount', type: 'NUMERIC' },
            { name: 'nature_of_delay', type: 'TEXT' },
            { name: 'date_notice_of_award', type: 'DATE' }
        ];

        for (const col of columns) {
            try {
                await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                console.log(`Checked/Added ${col.name}`);
            } catch (e) {
                console.log(`Failed ${col.name}: ${e.message}`);
            }
        }

        client.release();
        console.log("Done.");
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
