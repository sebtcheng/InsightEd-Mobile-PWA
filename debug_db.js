
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        const client = await pool.connect();
        console.log("✅ Connected to DB");

        const res = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'engineer_form'::regclass;
    `);

        console.log("🔍 Constraints on engineer_form:");
        console.table(res.rows);

        await client.release();
    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        pool.end();
    }
})();
