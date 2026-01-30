
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    const client = await pool.connect();
    try {
        console.log("🛠️ Forcefully Fixing Constraints...");

        // 1. Drop standard named constraint
        try {
            await client.query("ALTER TABLE engineer_form DROP CONSTRAINT IF EXISTS engineer_form_ipc_key");
            console.log("✅ Dropped engineer_form_ipc_key");
        } catch (e) { console.log("⚠️ " + e.message); }

        // 2. Drop potential backup name
        try {
            await client.query("ALTER TABLE engineer_form DROP CONSTRAINT IF EXISTS engineer_form_ipc_key1");
            console.log("✅ Dropped engineer_form_ipc_key1");
        } catch (e) { console.log("⚠️ " + e.message); }

        // 3. Find and destroy ANY unique constraint on IPC
        // This query finds constraints on column 'ipc' (attname)
        const res = await client.query(`
            SELECT conname 
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'engineer_form'::regclass 
            AND c.contype = 'u'
            AND a.attname = 'ipc';
        `);

        for (const row of res.rows) {
            console.log(`🔥 Dropping found constraint: ${row.conname}`);
            try {
                await client.query(`ALTER TABLE engineer_form DROP CONSTRAINT "${row.conname}"`);
                console.log("✅ Dropped!");
            } catch (e) { console.error("❌ Failed to drop:", e.message); }
        }

        console.log("🎉 Done!");

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
    } finally {
        client.release();
        pool.end();
    }
})();
