const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function verifyApi() {
    try {
        await client.connect();

        // Simulate the query used in the API
        const query = `
      SELECT 
        s.division, 
        SUM(COALESCE(sp.stat_sned_k, 0)) as stat_sned_k,
        SUM(COALESCE(sp.stat_disability_g1, 0)) as stat_disability_g1,
        SUM(COALESCE(sp.stat_als_g12, 0)) as stat_als_g12,
        SUM(COALESCE(sp.stat_muslim_k, 0)) as stat_muslim_k,
        SUM(COALESCE(sp.stat_ip_g5, 0)) as stat_ip_g5,
        SUM(COALESCE(sp.stat_displaced_g6, 0)) as stat_displaced_g6,
        SUM(COALESCE(sp.stat_repetition_g7, 0)) as stat_repetition_g7,
        SUM(COALESCE(sp.stat_overage_g8, 0)) as stat_overage_g8,
        SUM(COALESCE(sp.stat_dropout_g9, 0)) as stat_dropout_g9
      FROM schools s
      LEFT JOIN school_profiles sp ON s.school_id = sp.school_id
      LEFT JOIN school_summary ss ON s.school_id = ss.school_id
      WHERE TRIM(s.region) = 'Region XI'
      GROUP BY s.division
      ORDER BY s.division
      LIMIT 1;
    `;

        const res = await client.query(query);

        console.log("Found Columns in Result:");
        if (res.rows.length > 0) {
            console.log(Object.keys(res.rows[0]));
            console.log("Sample Data:", res.rows[0]);
        } else {
            console.log("No data returned.");
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

verifyApi();
