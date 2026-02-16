const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkAggregateColumns() {
    try {
        await client.connect();

        const categories = ['sned', 'disability', 'als', 'muslim', 'ip', 'displaced', 'repetition', 'overage', 'dropout'];
        const suffixes = ['', '_es', '_jhs', '_shs']; // '' for total

        console.log("Checking for existence of aggregate columns...");

        for (const cat of categories) {
            let missing = [];
            for (const suffix of suffixes) {
                const col = `stat_${cat}${suffix}`;
                const query = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'school_profiles' 
                AND column_name = '${col}'
            `;
                const res = await client.query(query);
                if (res.rows.length === 0) {
                    missing.push(col);
                }
            }
            if (missing.length > 0) {
                console.log(`Attribute ${cat} is missing columns: ${missing.join(', ')}`);
            } else {
                console.log(`Attribute ${cat} has all aggregate columns (Total, ES, JHS, SHS).`);
            }
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkAggregateColumns();
