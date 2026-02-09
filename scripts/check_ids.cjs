const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkIds() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT school_id, iern, school_name 
            FROM school_profiles 
            LIMIT 10
        `);
        console.table(res.rows);

        const count = await client.query(`
            SELECT count(*) as total, 
                   count(distinct school_id) as unique_ids, 
                   count(distinct iern) as unique_ierns 
            FROM school_profiles
        `);
        console.log("Counts:", count.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkIds();
