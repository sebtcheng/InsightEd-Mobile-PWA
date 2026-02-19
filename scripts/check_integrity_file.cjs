
const fs = require('fs');
const { Pool } = require('pg');

// Manual Env Load
let connString = 'postgres://postgres:password@localhost:5432/postgres';
if (fs.existsSync('.env')) {
    const env = fs.readFileSync('.env', 'utf8');
    const match = env.match(/DATABASE_URL=(.+)/);
    if (match) connString = match[1].trim().replace(/^['"]|['"]$/g, '');
}

const pool = new Pool({
    connectionString: connString,
    ssl: false
});

async function run() {
    const lines = [];
    const log = (msg) => {
        console.log(msg);
        lines.push(msg);
    };

    try {
        const client = await pool.connect();
        log("Connected");

        // 1. Total Rows
        const resCount = await client.query('SELECT COUNT(*) FROM masterlist_26_30');
        log(`Total Rows: ${resCount.rows[0].count}`);

        // 2. Shortage Sum
        const resSum = await client.query('SELECT SUM(estimated_classroom_shortage) as val FROM masterlist_26_30');
        log(`Total Shortage: ${resSum.rows[0].val}`);

        // 3. Check for duplicates (School ID + Storey + Classrooms + Year)
        const dupCheck = await client.query(`
            SELECT "school_id", "sty", "cl", "proposed_funding_year", COUNT(*)
            FROM masterlist_26_30
            GROUP BY "school_id", "sty", "cl", "proposed_funding_year"
            HAVING COUNT(*) > 1
        `);
        log(`Duplicate Groups (Same ID, Storey, CL, Year): ${dupCheck.rows.length}`);

        if (dupCheck.rows.length > 0) {
            log(`Examples:\n${JSON.stringify(dupCheck.rows.slice(0, 3), null, 2)}`);
        } else {
            log("No exact duplicates found on key fields.");
        }

        fs.writeFileSync('db_integrity.txt', lines.join('\n'));
        client.release();
    } catch (e) {
        log(`Error: ${e.message}`);
        fs.writeFileSync('db_integrity.txt', lines.join('\n'));
    } finally {
        pool.end();
    }
}
run();
