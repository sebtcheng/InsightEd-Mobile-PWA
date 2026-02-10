
import dotenv from 'dotenv';
import pg from 'pg';
import fetch from 'node-fetch'; // Standard fetch might be available globally in newer Node

dotenv.config();

const { Client } = pg;

// Use global fetch if available, else node-fetch
const _fetch = global.fetch || fetch;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function verifyRetention() {
    try {
        await client.connect();
        console.log("🔌 Connected to DB");

        // 1. Check if columns are gone
        const colCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'engineer_form' 
            AND column_name IN ('internal_description', 'external_description');
        `);

        if (colCheck.rows.length === 0) {
            console.log("✅ Columns 'internal_description' and 'external_description' are confirmed DELETED.");
        } else {
            console.error("❌ Columns still exist:", colCheck.rows.map(r => r.column_name));
        }

        // 2. Test Data Retention on Update
        const projRes = await client.query('SELECT project_id FROM engineer_form LIMIT 1');
        if (projRes.rows.length === 0) {
            console.log("⚠️ No projects found to test update.");
            return;
        }
        const projectId = projRes.rows[0].project_id;
        console.log(`ℹ️ Testing update on Project ID: ${projectId}`);

        const payload = {
            // Fields to verify retention/update
            numberOfClassrooms: 99,
            numberOfStoreys: 5,
            numberOfSites: 2,
            fundsUtilized: 123456.78,

            // Required fields for update logic
            uid: "TEST_UID",
            modifiedBy: "Tester",
            status: "Ongoing",
            accomplishmentPercentage: 50,
            statusAsOfDate: new Date().toISOString().split('T')[0],
            otherRemarks: "Retention Test ESM",

            // PDF dummy
            pow_pdf: "data:application/pdf;base64,JVBERi0xLg=="
        };

        // Ensure we hit the correct port. api/index.js usually uses PORT or 3000/3001
        // We will try localhost:3005 as before, ensuring we run server there
        const response = await _fetch(`http://localhost:3005/api/update-project/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${await response.text()}`);
        }

        const json = await response.json();
        console.log("✅ API Update Success:", json.message);

        // 3. Verify in DB
        const verifyRes = await client.query(`
            SELECT number_of_classrooms, number_of_storeys, number_of_sites, funds_utilized 
            FROM engineer_form 
            WHERE project_id = $1
        `, [json.project.project_id]); // The new row ID

        const row = verifyRes.rows[0];
        console.log("ℹ️ DB Row:", row);

        if (
            row.number_of_classrooms === 99 &&
            row.number_of_storeys === 5 &&
            row.number_of_sites === 2 &&
            Math.abs(row.funds_utilized - 123456.78) < 0.01
        ) {
            console.log("✅ Data Retention VERIFIED: All fields saved correctly.");
        } else {
            console.error("❌ Data Retention FAILED:", row);
        }

    } catch (err) {
        console.error("❌ Test Failed:", err);
    } finally {
        await client.end();
    }
}

verifyRetention();
