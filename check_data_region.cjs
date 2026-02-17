const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkDataByRegion() {
    try {
        await client.connect();

        const query = `
      SELECT s.region, COUNT(*) as count 
      FROM school_profiles sp
      JOIN schools s ON sp.school_id = s.school_id
      WHERE sp.stat_sned_k > 0 OR sp.stat_ip_k > 0 
      GROUP BY s.region
      ORDER BY count DESC;
    `;

        console.log("Checking regions with non-zero demographic data...");
        const res = await client.query(query);

        if (res.rows.length > 0) {
            res.rows.forEach(row => {
                console.log(`${row.region}: ${row.count} rows`);
            });
        } else {
            console.log("No data found for any region.");
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkDataByRegion();
