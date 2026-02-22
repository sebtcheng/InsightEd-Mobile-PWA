
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const MASTER_PASSWORD = 'STRIDEINSIGHTED2026';

async function testMasterLogin(email) {
    console.log(`\n--- Testing ${email} ---`);
    try {
        const response = await fetch(`${BASE_URL}/api/auth/master-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                masterPassword: MASTER_PASSWORD
            })
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text}`);

    } catch (error) {
        console.error(`Error:`, error.message);
    }
}

async function run() {
    await testMasterLogin('test_master_login@example.com');
}

run();
