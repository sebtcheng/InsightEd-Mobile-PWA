const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkDupes() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT iern, count(*) as cnt
            FROM school_profiles 
            GROUP BY iern 
            HAVING count(*) > 1
        `);
        console.log("Duplicate IERNs found:", res.rowCount);

        if (res.rowCount > 0) {
            const dupeIerns = res.rows.map(r => r.iern);
            // Get details for these IERNs
            const details = await client.query(`
                SELECT iern, school_id, school_name 
                FROM school_profiles 
                WHERE iern = ANY($1)
                ORDER BY iern, school_id
            `, [dupeIerns]);
            console.table(details.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkDupes();
