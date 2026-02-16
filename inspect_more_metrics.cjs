const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function inspectSchemaMore() {
    try {
        await client.connect();

        // Search for shifting columns again with a broader query
        const queryShifting = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'school_profiles' 
      AND column_name LIKE '%shifting%'
    `;
        const resShifting = await client.query(queryShifting);
        console.log("--- Shifting Columns ---");
        console.log(resShifting.rows.map(r => r.column_name));

        // Search for learning delivery related terms
        const terms = ['modality', 'mode', 'face', 'f2f', 'distance', 'hybrid', 'instruction'];
        for (const term of terms) {
            const query = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'school_profiles' 
          AND column_name LIKE '%${term}%'
        `;
            const res = await client.query(query);
            if (res.rows.length > 0) {
                console.log(`--- Columns for '${term}' ---`);
                console.log(res.rows.map(r => r.column_name));
            }
        }

        // Also check school_summary just in case
        const querySummary = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'school_summary' 
      AND (column_name LIKE '%shifting%' OR column_name LIKE '%delivery%' OR column_name LIKE '%mode%')
    `;
        const resSummary = await client.query(querySummary);
        console.log("--- Relevant Columns in school_summary ---");
        console.log(resSummary.rows.map(r => r.column_name));

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

inspectSchemaMore();
