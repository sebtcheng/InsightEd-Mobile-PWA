const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTable() {
    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'buildable_spaces';
    `);

        if (res.rows.length > 0) {
            console.log("✅ Table 'buildable_spaces' EXISTS.");

            // Check columns
            const cols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'buildable_spaces';
      `);
            console.log("Columns:", cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));

        } else {
            console.error("❌ Table 'buildable_spaces' DOES NOT EXIST.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

checkTable();
