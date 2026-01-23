
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function migrate() {
    console.log("🚀 Starting Structural Migration: Reordering IERN and Removing control_number...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get all columns except the ones we want to remove or reposition
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'school_profiles' 
            ORDER BY ordinal_position
        `);

        const allColumns = res.rows.map(r => r.column_name);

        // Remove 'control_number' and 'iern' from the list to handle them specifically
        const otherColumns = allColumns.filter(c => c !== 'control_number' && c !== 'iern');

        // Desired order: school_id (PK), iern, then everything else
        // Assuming school_id is the first column
        const schoolIdIndex = otherColumns.indexOf('school_id');
        if (schoolIdIndex > -1) {
            otherColumns.splice(schoolIdIndex, 1);
        }

        const newOrder = ['school_id', 'iern', ...otherColumns];
        const colsSql = newOrder.join(', ');

        console.log(`Reordering columns: ${newOrder.slice(0, 5).join(', ')} ...`);

        // 2. Create new table with new order
        await client.query(`CREATE TABLE school_profiles_new AS SELECT ${colsSql} FROM school_profiles`);

        // 3. Drop old table and rename new one
        await client.query(`DROP TABLE school_profiles`);
        await client.query(`ALTER TABLE school_profiles_new RENAME TO school_profiles`);

        // 4. Restore Primary Key
        await client.query(`ALTER TABLE school_profiles ADD PRIMARY KEY (school_id)`);

        await client.query('COMMIT');
        console.log("✅ Successfully reordered 'iern' to the front and removed 'control_number'.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
