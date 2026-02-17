const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkShiftValues() {
    try {
        await client.connect();

        const query = "SELECT DISTINCT shift_kinder, COUNT(*) FROM school_profiles GROUP BY shift_kinder LIMIT 10";
        console.log("--- Distinct values for 'shift_kinder' ---");
        const res = await client.query(query);
        console.table(res.rows);

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkShiftValues();
