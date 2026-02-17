
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspectSiteValues() {
    try {
        await client.connect();

        const queries = [
            "SELECT DISTINCT res_electricity_source FROM school_profiles LIMIT 20",
            "SELECT DISTINCT res_water_source FROM school_profiles LIMIT 20",
            "SELECT DISTINCT sha_category FROM school_profiles LIMIT 20",
            "SELECT DISTINCT res_buildable_space FROM school_profiles LIMIT 20"
        ];

        for (const q of queries) {
            console.log(`\n--- QUERY: ${q} ---`);
            const res = await client.query(q);
            res.rows.forEach(r => console.log(Object.values(r)[0]));
        }

    } catch (err) {
        console.error('Error inspecting values:', err);
    } finally {
        await client.end();
    }
}

inspectSiteValues();
