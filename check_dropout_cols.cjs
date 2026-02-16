const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkDropoutCols() {
    try {
        await client.connect();

        // Check dropout
        const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profiles' AND column_name LIKE 'stat_dropout%'");
        console.log("Dropout Columns:", cols.rows.map(r => r.column_name));

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkDropoutCols();
