const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkSchoolIds() {
    try {
        await client.connect();

        // Check Region XI school IDs format
        console.log("Region XI School IDs (Schools table):");
        const resXI = await client.query("SELECT school_id, school_name FROM schools WHERE region = 'Region XI' LIMIT 5");
        resXI.rows.forEach(r => console.log(`'${r.school_id}'`));

        // Check school_profiles school IDs format
        console.log("\nSchool Profiles IDs:");
        const resProfiles = await client.query("SELECT school_id FROM school_profiles LIMIT 5");
        resProfiles.rows.forEach(r => console.log(`'${r.school_id}'`));

        // Check if any Region XI school ID exists in profiles
        const checkJoin = `
      SELECT COUNT(*) 
      FROM schools s 
      JOIN school_profiles sp ON TRIM(s.school_id) = TRIM(sp.school_id)
      WHERE s.region = 'Region XI'
    `;
        const resJoin = await client.query(checkJoin);
        console.log(`\nMatches found with TRIM match: ${resJoin.rows[0].count}`);

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkSchoolIds();
