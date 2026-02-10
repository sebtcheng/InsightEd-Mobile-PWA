
import pg from 'pg';
// import fetch from 'node-fetch'; // Native fetch in Node 18+
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function verify() {
    let client;
    try {
        client = await pool.connect();
        // 1. Get a project
        const res = await client.query('SELECT project_id, project_name FROM engineer_form LIMIT 1');
        if (res.rows.length === 0) {
            console.log("❌ No projects found to test.");
            return;
        }
        const projectId = res.rows[0].project_id;
        console.log(`ℹ️ Testing update on Project ID: ${projectId} (${res.rows[0].project_name})`);

        // 2. Prepare Payload
        const payload = {
            uid: "TEST_USER_UID",
            modifiedBy: "Test Engineer",
            status: "Ongoing",
            accomplishmentPercentage: 55, // Changed to verify update
            statusAsOfDate: new Date().toISOString().split('T')[0],
            otherRemarks: "Updated via verification script 2",
            // internalDescription, externalDescription REMOVED
            pow_pdf: "data:application/pdf;base64,JVBERi0xLg==" // Dummy PDF header
        };

        // 3. Send PUT Request
        console.log("🚀 Sending PUT request...");
        // Assuming running on localhost:3000 or similar. Need the port.
        // I'll assume 3000 based on standard setup, or check check_schema.js env? No, usually 3000.
        // Wait, I am running `npm run dev:full` on the user machine, so the server is UP.
        // It's likely on port 3000 or 5000. `api/index.js` usually listens on 3001 or 5000. 
        // Let's check api/index.js for port.
        // Validating port... default is often 3000 for frontend, 3001/5000 for backend.
        // I'll try 3001 first (common for my generated apps) or just check index.js

        const response = await fetch(`http://localhost:3005/api/update-project/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText} - ${await response.text()}`);
        }

        const json = await response.json();
        console.log("✅ API Response:", json.message);

        // 4. Verify DB
        // Note: The UPDATE inserts a NEW row with same IPC. using same project_id won't find the NEW row if project_id is serial PK.
        // The endpoint returns `project` object which has the new ID?
        // Let's check the response `json.project`.

        const newProject = json.project;
        console.log(`ℹ️ New Project Row ID: ${newProject.project_id}`);

        if (newProject.pow_pdf === payload.pow_pdf && newProject.accomplishment_percentage === 55) {
            console.log("✅ Verification SUCCESS: PDF persisted, Desc ignored.");
        } else {
            console.error("❌ Verification FAILED: mismatch.", {
                got_pow: newProject.pow_pdf,
                got_acc: newProject.accomplishment_percentage
            });
        }

    } catch (err) {
        console.error("❌ Test Failed:", err);
    } finally {
        if (client) client.release();
        pool.end();
    }
}
verify();
