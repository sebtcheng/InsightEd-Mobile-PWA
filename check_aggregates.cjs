const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkAggregates() {
    try {
        await client.connect();

        // Check if aggregate columns have data when grade-level columns don't
        const query = `
      SELECT 
        s.region,
        COUNT(*) as total_rows,
        SUM(CASE WHEN sp.stat_sned_es > 0 THEN 1 ELSE 0 END) as rows_with_sned_es,
        SUM(CASE WHEN (sp.stat_sned_g1 + sp.stat_sned_g2 + sp.stat_sned_g3 + sp.stat_sned_g4 + sp.stat_sned_g5 + sp.stat_sned_g6) > 0 THEN 1 ELSE 0 END) as rows_with_sned_grades
      FROM school_profiles sp
      JOIN schools s ON sp.school_id = s.school_id
      WHERE s.region = 'Region XI'
      GROUP BY s.region;
    `;

        console.log("Checking standard vs aggregate columns for Region XI...");
        const res = await client.query(query);

        if (res.rows.length > 0) {
            console.log(res.rows[0]);
        } else {
            console.log("No data found for Region XI.");
        }

        // Also check globally just in case
        const queryGlobal = `
      SELECT 
        COUNT(*) as total_rows,
        SUM(CASE WHEN sp.stat_sned_es > 0 THEN 1 ELSE 0 END) as rows_with_sned_es,
        SUM(CASE WHEN (sp.stat_sned_g1 + sp.stat_sned_g2 + sp.stat_sned_g3 + sp.stat_sned_g4 + sp.stat_sned_g5 + sp.stat_sned_g6) > 0 THEN 1 ELSE 0 END) as rows_with_sned_grades
      FROM school_profiles sp;
    `;
        console.log("Checking globally...");
        const resGlobal = await client.query(queryGlobal);
        console.log(resGlobal.rows[0]);

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkAggregates();
