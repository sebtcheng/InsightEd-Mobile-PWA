import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
    },
});

async function checkColumns() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB.");

        // Check table existence
        const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name = 'engineer_form' OR table_name = 'engineer_forms');
    `);

        if (tableRes.rows.length === 0) {
            console.log("❌ Table 'engineer_form' (or plural) NOT FOUND.");
        } else {
            console.log("✅ Found tables:", tableRes.rows.map(r => r.table_name).join(', '));
        }

        // Check columns
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form';
    `);

        console.log("\nColumns in 'engineer_form':");
        res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

        const hasLat = res.rows.some(r => r.column_name === 'latitude');
        const hasLong = res.rows.some(r => r.column_name === 'longitude');

        if (!hasLat || !hasLong) {
            console.log("\n❌ MISSING COORDINATE COLUMNS!");
            if (!hasLat) console.log("   - Missing: latitude");
            if (!hasLong) console.log("   - Missing: longitude");
        } else {
            console.log("\n✅ Coordinate columns exist!");
        }

        client.release();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

checkColumns();
