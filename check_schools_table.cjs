const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkSchoolsTable() {
    try {
        await client.connect();

        // Check school count in Region XI
        const countQuery = "SELECT COUNT(*) FROM schools WHERE region = 'Region XI'";
        const resCount = await client.query(countQuery);
        console.log(`Region XI School Count: ${resCount.rows[0].count}`);

        // Check columns in schools table
        const query = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schools' 
      AND (
        column_name LIKE '%sned%' OR 
        column_name LIKE '%disability%' OR 
        column_name LIKE '%als%'
      );
    `;
        const res = await client.query(query);
        console.log("Demographic columns in 'schools' table:");
        if (res.rows.length === 0) {
            console.log("None found.");
        } else {
            console.log(res.rows.map(r => r.column_name));
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkSchoolsTable();
