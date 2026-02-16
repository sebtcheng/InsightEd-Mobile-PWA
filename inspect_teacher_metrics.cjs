const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function inspectSchemaTeacherMore() {
    try {
        await client.connect();

        console.log("Checking for detailed teacher grade columns...");

        const queries = [
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profiles' AND column_name ILIKE '%teach%' AND (column_name ILIKE '%k%' OR column_name ILIKE '%g1%' OR column_name ILIKE '%grade%')",
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profiles' AND column_name ILIKE '%fac%'", // Faculty
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profiles' AND column_name ILIKE '%kinder%' AND column_name ILIKE '%teach%'",
        ];

        for (const q of queries) {
            const res = await client.query(q);
            if (res.rows.length > 0) {
                console.log(`--- Results for query: ${q} ---`);
                console.log(res.rows.map(r => r.column_name));
            }
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

inspectSchemaTeacherMore();
