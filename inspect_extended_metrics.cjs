
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspectNewMetricsSchema() {
    try {
        await client.connect();

        const inventoryTerms = ['laptop', 'printer', 'cart', 'tv', 'projector', 'tablet', 'desktop'];
        const roomTerms = ['lab', 'science', 'computer', 'workshop', 'tle', 'clinic', 'library'];
        const siteTerms = ['electric', 'power', 'water', 'buildable', 'sha', 'ownership', 'title', 'supply', 'source'];

        console.log('--- INSPECTING INVENTORY COLUMNS ---');
        for (const term of inventoryTerms) {
            const query = `SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profiles' AND column_name ILIKE '%${term}%'`;
            const res = await client.query(query);
            if (res.rows.length > 0) res.rows.forEach(r => console.log(r.column_name));
        }

        console.log('\n--- INSPECTING SPECIALIZED ROOMS COLUMNS ---');
        for (const term of roomTerms) {
            const query = `SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profiles' AND column_name ILIKE '%${term}%'`;
            const res = await client.query(query);
            if (res.rows.length > 0) res.rows.forEach(r => console.log(r.column_name));
        }

        console.log('\n--- INSPECTING SITE & UTILITIES COLUMNS ---');
        for (const term of siteTerms) {
            const query = `SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profiles' AND column_name ILIKE '%${term}%'`;
            const res = await client.query(query);
            if (res.rows.length > 0) res.rows.forEach(r => console.log(r.column_name));
        }

    } catch (err) {
        console.error('Error inspecting schema:', err);
    } finally {
        await client.end();
    }
}

inspectNewMetricsSchema();
