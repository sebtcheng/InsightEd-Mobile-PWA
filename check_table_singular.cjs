const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkTableExistence() {
    try {
        await client.connect();

        // Check if table 'school_profile' exists (singular)
        const query = "SELECT table_name FROM information_schema.tables WHERE table_name = 'school_profile'";
        const res = await client.query(query);

        if (res.rows.length > 0) {
            console.log("Table 'school_profile' (singular) EXISTS!");
            // Check columns in singular table
            const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profile'");
            console.log("Columns:", cols.rows.map(r => r.column_name));
        } else {
            console.log("Table 'school_profile' (singular) DOES NOT exist.");
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkTableExistence();
