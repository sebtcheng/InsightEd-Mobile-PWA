import pg from 'pg';
const { Pool } = pg;

// Use the connection string from your env or the one we know
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_6aW9NeDShylE@ep-crimson-firefly-a13367y4-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form';
    `);

        console.log("Columns in engineer_form:");
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

        const expected = ['construction_start_date', 'project_category', 'scope_of_work'];
        const missing = expected.filter(col => !res.rows.find(r => r.column_name === col));

        if (missing.length > 0) {
            console.log('\n❌ MISSING COLUMNS:', missing);
            // Attempt to add them
            console.log("Attempting to add missing columns...");
            for (const col of missing) {
                let type = 'TEXT';
                if (col === 'construction_start_date') type = 'TIMESTAMP';

                try {
                    await client.query(`ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS ${col} ${type}`);
                    console.log(`✅ Added ${col}`);
                } catch (e) {
                    console.error(`❌ Failed to add ${col}:`, e.message);
                }
            }
        } else {
            console.log('\n✅ All new columns are present.');
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkColumns();
