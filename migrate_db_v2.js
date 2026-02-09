import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB");

        const columns = [
            { name: 'construction_start_date', type: 'TIMESTAMP' },
            { name: 'project_category', type: 'TEXT' },
            { name: 'scope_of_work', type: 'TEXT' }
        ];

        for (const col of columns) {
            try {
                await client.query(`ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                console.log(`✅ Ensure column ${col.name} exists`);
            } catch (e) {
                console.error(`❌ Error adding ${col.name}:`, e.message);
            }
        }

        // Verify
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'engineer_form'
            AND column_name IN ('construction_start_date', 'project_category', 'scope_of_work');
        `);
        console.log("Verified Columns:", res.rows.map(r => r.column_name));

        client.release();
    } catch (err) {
        console.error("Migration Error:", err);
    } finally {
        pool.end();
    }
}

migrate();
