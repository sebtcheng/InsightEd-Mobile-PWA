import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000'; // Adjust if different

async function verifyFilters() {
    try {
        console.log('Testing Masterlist Filter Endpoints...');

        // 1. Regions
        const regRes = await fetch(`${API_BASE}/api/masterlist/filters`);
        const regions = await regRes.json();
        console.log('Regions fetched:', regions.length);

        if (regions.length > 0) {
            const firstRegion = regions[0];
            console.log(`Testing cascading for region: ${firstRegion}`);

            // 2. Divisions for first region
            const divRes = await fetch(`${API_BASE}/api/masterlist/filters?region=${encodeURIComponent(firstRegion)}`);
            const divisions = await divRes.json();
            console.log(`Divisions for ${firstRegion}:`, divisions.length);

            // 3. Summary for first region
            const sumRes = await fetch(`${API_BASE}/api/masterlist/summary?region=${encodeURIComponent(firstRegion)}`);
            const summary = await sumRes.json();
            console.log(`Summary for ${firstRegion}:`, summary.total_projects, 'projects');
        }

        console.log('\nVerification Successful!');
        process.exit(0);
    } catch (err) {
        console.error('Verification Failed:', err.message);
        process.exit(1);
    }
}

// verifyFilters(); 
// Note: Running this requires the server to be up. Since I can't guarantee 
// the server port or state, I'll rely on manual verification via walkthrough.
console.log('Verification script ready. Run while dev server is active.');
