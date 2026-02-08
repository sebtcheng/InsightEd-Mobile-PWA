import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runTest() {
    const TEST_ID = '999999';
    const API_URL = 'http://localhost:3001'; // Temp port for verification

    console.log('🚀 Starting Workflow Verification...');

    try {
        // 0. Pre-cleanup
        console.log('🧹 Pre-cleanup: Removing old test data...');
        try {
            await pool.query('DELETE FROM schools WHERE school_id = $1', [TEST_ID]);
            await pool.query('DELETE FROM pending_schools WHERE school_id = $1', [TEST_ID]);
        } catch (e) { console.log('Cleanup error (ignoring):', e.message); }

        // 1. Submit School
        console.log('\nTesting SDO Submission...');
        const submitRes = await fetch(`${API_URL}/api/sdo/submit-school`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                school_id: TEST_ID,
                school_name: 'TEST_VERIFICATION_SCHOOL',
                region: 'TEST_REGION',
                division: 'TEST_DIVISION',
                district: 'TEST_DISTRICT',
                province: 'TEST_PROV',
                municipality: 'TEST_MUNI',
                barangay: 'TEST_BRGY',
                street_address: 'Test Street, Test City', // Correct field now
                curricular_offering: 'Purely ES',
                submitted_by: 'test_sdo_user',
                submitted_by_name: 'Test Setup'
            })
        });

        if (!submitRes.ok) {
            const text = await submitRes.text();
            console.error('❌ Submission Failed:', text);
            process.exit(1);
        }

        const submitData = await submitRes.json();
        const pendingId = submitData.pending_id;
        console.log(`✅ Submission Successful! Pending ID: ${pendingId}`);

        // 2. Approve School
        console.log(`\nTesting Admin Approval for ID ${pendingId}...`);
        const approveRes = await fetch(`${API_URL}/api/admin/approve-school/${pendingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reviewed_by: 'test_admin_user',
                reviewed_by_name: 'Test Admin'
            })
        });

        if (!approveRes.ok) {
            const text = await approveRes.text();
            console.error('❌ Approval Failed:', text);
            process.exit(1);
        }
        console.log('✅ Approval Successful!');

        // 3. Verify in DB
        console.log('\nVerifying record in schools table...');
        const dbRes = await pool.query('SELECT * FROM schools WHERE school_id = $1', [TEST_ID]);
        if (dbRes.rows.length > 0) {
            console.log('✅ Record found in schools table!');
            const row = dbRes.rows[0];
            if (row.street_address === 'Test Street, Test City') {
                console.log('✅ Column mapping verification pass: street_address preserved.');
            } else {
                console.warn('⚠️ Column mapping warning: street_address mismatch or null.', row);
            }
        } else {
            console.error('❌ Record NOT found in schools table!');
            process.exit(1);
        }

    } catch (err) {
        console.error('❌ Unexpected Error:', err);
        process.exit(1);
    } finally {
        // 4. Cleanup
        console.log('\nCleaning up test data...');
        try {
            await pool.query('DELETE FROM schools WHERE school_id = $1', [TEST_ID]);
            await pool.query('DELETE FROM pending_schools WHERE school_id = $1', [TEST_ID]);
            console.log('✅ Cleanup complete.');
        } catch (cleanupErr) {
            console.error('Warning: Cleanup failed', cleanupErr);
        }
        await pool.end();
    }
}

runTest();
