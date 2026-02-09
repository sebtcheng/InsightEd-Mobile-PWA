const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function dropResourceColumns() {
    console.log("Dropping resource columns...");
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE school_profiles 
            DROP COLUMN IF EXISTS res_armchairs_good,
            DROP COLUMN IF EXISTS res_armchairs_repair,
            DROP COLUMN IF EXISTS res_teacher_tables_good,
            DROP COLUMN IF EXISTS res_teacher_tables_repair,
            DROP COLUMN IF EXISTS res_blackboards_good,
            DROP COLUMN IF EXISTS res_blackboards_defective,
            DROP COLUMN IF EXISTS res_desktops_instructional,
            DROP COLUMN IF EXISTS res_desktops_admin,
            DROP COLUMN IF EXISTS res_laptops_teachers,
            DROP COLUMN IF EXISTS res_tablets_learners,
            DROP COLUMN IF EXISTS res_printers_working,
            DROP COLUMN IF EXISTS res_projectors_working,
            DROP COLUMN IF EXISTS res_internet_type;
        `);
        console.log("✅ Resource columns dropped successfully.");
    } catch (err) {
        console.error("❌ Error dropping columns:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

dropResourceColumns();
