
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const client = await pool.connect();
        console.log("--- DATA INTEGRITY CHECK ---");

        // 1. Total Rows
        const resCount = await client.query('SELECT COUNT(*) FROM masterlist_26_30');
        console.log(`Total Rows: ${resCount.rows[0].count}`);

        // 2. Sum of Shortage
        const resSum = await client.query('SELECT SUM(estimated_classroom_shortage) as total FROM masterlist_26_30');
        console.log(`Total Shortage (Sum): ${resSum.rows[0].total}`);

        // 3. Check for exact row duplicates (all cols same) - simplified check via ID if exists, or School ID + Project attributes
        // Since we don't know if there's a unique ID, let's check duplicates based on School ID + Funding Year + Storey + Classrooms
        // This defines a "unique project" conceptually for this check.
        const uniqueCheck = await client.query(`
        SELECT "school_id", "proposed_funding_year", "sty", "cl", COUNT(*)
        FROM masterlist_26_30
        GROUP BY "school_id", "proposed_funding_year", "sty", "cl"
        HAVING COUNT(*) > 1
        LIMIT 10
    `);

        if (uniqueCheck.rows.length > 0) {
            console.log("\n[WARNING] POTENTIAL DUPLICATES FOUND (Sample):");
            console.log(JSON.stringify(uniqueCheck.rows, null, 2));

            // Count total potential duplicates
            const dupCount = await client.query(`
            SELECT COUNT(*) FROM (
                SELECT "school_id", "proposed_funding_year", "sty", "cl"
                FROM masterlist_26_30
                GROUP BY "school_id", "proposed_funding_year", "sty", "cl"
                HAVING COUNT(*) > 1
            ) as sub
        `);
            console.log(`\nTotal Groups with Duplicates: ${dupCount.rows[0].count}`);
        } else {
            console.log("\n[OK] No obvious duplicates found based on School + Year + Sty + Cl.");
        }

        client.release();
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
