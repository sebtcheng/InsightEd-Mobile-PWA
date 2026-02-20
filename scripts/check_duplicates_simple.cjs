
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect().then(client => {
    console.log("Connected");

    // Check total count
    client.query('SELECT COUNT(*) FROM masterlist_26_30')
        .then(res => console.log('Total Rows:', res.rows[0].count));

    // Check distinct sum
    client.query('SELECT SUM(estimated_classroom_shortage) FROM masterlist_26_30')
        .then(res => console.log('Total Shortage:', res.rows[0].sum));

    // Check duplicates
    client.query(`
        SELECT "school_id", "sty", "cl", COUNT(*)
        FROM masterlist_26_30
        GROUP BY "school_id", "sty", "cl"
        HAVING COUNT(*) > 1
    `).then(res => {
        console.log('Duplicate Groups Found:', res.rows.length);
        if (res.rows.length > 0) {
            console.log('Sample Duplicate:', JSON.stringify(res.rows[0]));
        }
        client.release();
        pool.end();
    });
}).catch(e => console.error(e));
