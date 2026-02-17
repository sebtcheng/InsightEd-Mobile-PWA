const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkProfiles() {
    try {
        await client.connect();

        // Check distinct regions in school_profiles
        const query = "SELECT region, COUNT(*) FROM school_profiles GROUP BY region ORDER BY count DESC";
        console.log("Regions in school_profiles:");
        const res = await client.query(query);
        res.rows.forEach(r => console.log(`${r.region}: ${r.count}`));

        // Check if school_ids look like standard school IDs
        const sample = await client.query("SELECT school_id, school_name FROM school_profiles LIMIT 5");
        console.log("\nSample School IDs in profiles:");
        sample.rows.forEach(r => console.log(`${r.school_id} (${r.school_name})`));

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkProfiles();
