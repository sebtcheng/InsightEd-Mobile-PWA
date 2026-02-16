const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkMetricDetails() {
    try {
        await client.connect();

        // Check values in 'mode_kinder'
        const resMode = await client.query("SELECT DISTINCT mode_kinder, COUNT(*) FROM school_profiles GROUP BY mode_kinder LIMIT 10");
        console.log("--- Distinct values for 'mode_kinder' (Learning Delivery) ---");
        console.table(resMode.rows);

        // Check data type of 'adm_*' columns
        const resAdm = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'school_profiles' 
      AND column_name LIKE 'adm_%'
    `);
        console.log("--- Data Types for ADM Columns ---");
        console.table(resAdm.rows);

        // Search for shifting related columns again with broader scope
        const terms = ['sched', 'session', 'shift', 'am', 'pm', 'morning', 'afternoon'];
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


    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkMetricDetails();
