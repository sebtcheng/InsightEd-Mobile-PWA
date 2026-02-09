const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'school_profiles'
            AND column_name IN (
                'res_armchairs_good', 'res_armchairs_repair', 
                'res_teacher_tables_good', 'res_teacher_tables_repair',
                'res_blackboards_good', 'res_blackboards_defective',
                'res_desktops_instructional', 'res_desktops_admin',
                'res_laptops_teachers', 'res_tablets_learners',
                'res_printers_working', 'res_projectors_working',
                'res_internet_type', 'res_faucets', 'res_ownership_type'
            );
        `);

        console.log("Existing columns:", res.rows.map(r => r.column_name));
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkColumns();
