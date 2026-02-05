// Native fetch in Node 18+

async function testMaintenance() {
    const baseUrl = 'http://localhost:3000'; // Adjust if needed

    console.log("1. Checking Initial Status...");
    try {
        const res1 = await fetch(`${baseUrl}/api/settings/maintenance_mode`);
        console.log("Initial Status:", await res1.json());
    } catch (e) {
        console.log("Error fetching status:", e.message);
    }

    console.log("\n2. Enabling Maintenance Mode...");
    try {
        const res2 = await fetch(`${baseUrl}/api/settings/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: 'maintenance_mode',
                value: 'true',
                userUid: 'test_script'
            })
        });
        console.log("Enable Response:", await res2.json());
    } catch (e) {
        console.log("Error enabling:", e.message);
    }

    console.log("\n3. Checking Status (Should be true)...");
    try {
        const res3 = await fetch(`${baseUrl}/api/settings/maintenance_mode`);
        const data3 = await res3.json();
        console.log("Status:", data3);
        if (data3.value === 'true') console.log("✅ Verified: True");
        else console.log("❌ Failed: Not True");
    } catch (e) {
        console.log("Error fetching status:", e.message);
    }

    console.log("\n4. Disabling Maintenance Mode...");
    try {
        const res4 = await fetch(`${baseUrl}/api/settings/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: 'maintenance_mode',
                value: 'false',
                userUid: 'test_script'
            })
        });
        console.log("Disable Response:", await res4.json());
    } catch (e) {
        console.log("Error disabling:", e.message);
    }

    console.log("\n5. Checking Status (Should be false)...");
    try {
        const res5 = await fetch(`${baseUrl}/api/settings/maintenance_mode`);
        const data5 = await res5.json();
        console.log("Status:", data5);
        if (data5.value === 'false') console.log("✅ Verified: False");
        else console.log("❌ Failed: Not False");
    } catch (e) {
        console.log("Error fetching status:", e.message);
    }
}

testMaintenance();
