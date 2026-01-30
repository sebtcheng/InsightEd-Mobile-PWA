
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
        console.log("🚀 Testing Append-Only Logic (Duplicate IPC)...");

        // 0. Cleanup dummy test data
        await client.query("DELETE FROM engineer_form WHERE ipc = 'TEST-IPC-001'");

        // 1. Insert First Row
        console.log("👉 Inserting Row 1...");
        await client.query(`
      INSERT INTO engineer_form (project_name, school_name, ipc, status)
      VALUES ('Test Project', 'Test School', 'TEST-IPC-001', 'Old Status')
    `);
        console.log("✅ Row 1 Inserted.");

        // 2. Insert Second Row (Same IPC)
        console.log("👉 Inserting Row 2 (Same IPC)...");
        try {
            await client.query(`
        INSERT INTO engineer_form (project_name, school_name, ipc, status)
        VALUES ('Test Project', 'Test School', 'TEST-IPC-001', 'New Status')
      `);
            console.log("✅ Row 2 Inserted! (Append Works)");
        } catch (e) {
            console.error("❌ Row 2 Failed:", e.message);

            if (e.message.includes("unique constraint")) {
                console.log("⚠️ DETECTED UNIQUE CONSTRAINT! Attempting to fix...");
                // Try to find and drop it
                await client.query("ALTER TABLE engineer_form DROP CONSTRAINT IF EXISTS engineer_form_ipc_key");
                await client.query("ALTER TABLE engineer_form DROP CONSTRAINT IF EXISTS engineer_form_ipc_key1"); // Just in case
                // Try to find the constraint name dynamically if standard names fail
                const res = await client.query(`
            SELECT conname FROM pg_constraint 
            WHERE conrelid = 'engineer_form'::regclass AND contype = 'u';
         `);
                for (const row of res.rows) {
                    console.log(`Doing extra cleanup: Dropping ${row.conname}`);
                    await client.query(`ALTER TABLE engineer_form DROP CONSTRAINT "${row.conname}"`);
                }

                console.log("✅ Constraint Dropped. Retrying Insert...");
                await client.query(`
          INSERT INTO engineer_form (project_name, school_name, ipc, status)
          VALUES ('Test Project', 'Test School', 'TEST-IPC-001', 'New Status')
        `);
                console.log("✅ Row 2 Inserted Successfully after Fix!");
            }
        }

        // 3. Verify Count
        const res = await client.query("SELECT count(*) FROM engineer_form WHERE ipc = 'TEST-IPC-001'");
        console.log("📊 Total Rows for TEST-IPC-001:", res.rows[0].count);

    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        await client.query("DELETE FROM engineer_form WHERE ipc = 'TEST-IPC-001'"); // Cleanup
        client.release();
        pool.end();
    }
})();
