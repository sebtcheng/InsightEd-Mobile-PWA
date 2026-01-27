import fetch from 'node-fetch';

async function checkData() {
    try {
        console.log("Fetching Regions...");
        const res = await fetch('http://localhost:5000/api/monitoring/regions');
        const regions = await res.json();
        console.log("Regions Data Sample:", JSON.stringify(regions[0], null, 2));

        // Get a region to test
        const region = regions[0]?.region || 'NCR';
        console.log(`Fetching Projects for ${region}...`);

        const params = new URLSearchParams({ region });
        const resProj = await fetch(`http://localhost:5000/api/monitoring/engineer-projects?${params}`);
        const projects = await resProj.json();

        console.log(`Found ${projects.length} projects.`);
        // Log unique statuses
        const statuses = [...new Set(projects.map(p => p.status))];
        console.log("Unique Statuses Found:", statuses);

        // Also check what 'engineer-stats' returns
        const resStats = await fetch(`http://localhost:5000/api/monitoring/engineer-stats?${params}`);
        const stats = await resStats.json();
        console.log("Engineer Stats Endpoint Return:", stats);

    } catch (e) {
        console.error(e);
    }
}

checkData();
