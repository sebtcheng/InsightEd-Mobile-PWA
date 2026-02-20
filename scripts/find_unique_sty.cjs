
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function run() {
    try {
        const res = await pool.query('SELECT DISTINCT sty FROM masterlist_26_30 ORDER BY sty');
        fs.writeFileSync('unique_sty.json', JSON.stringify(res.rows, null, 2));
        console.log('Results written to unique_sty.json');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
