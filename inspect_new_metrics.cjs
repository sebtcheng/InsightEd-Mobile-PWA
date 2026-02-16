const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function inspectSchemaFormetrics() {
    try {
        await client.connect();

        const keywords = ['shifting', 'delivery', 'adm', 'mdl', 'odl', 'tvi', 'blended'];

        for (const keyword of keywords) {
            const query = `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'school_profiles' 
          AND column_name LIKE '%${keyword}%'
          ORDER BY column_name;
        `;

            const res = await client.query(query);

            console.log(`\n--- Columns for '${keyword}' ---`);
            if (res.rows.length === 0) {
                console.log("No columns found.");
            } else {
                res.rows.forEach(row => {
                    console.log(`${row.column_name}`);
                });
            }
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

inspectSchemaFormetrics();
