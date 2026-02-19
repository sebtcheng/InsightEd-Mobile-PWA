
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log("--- 1. Adding district column to schools table ---");
        await client.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS district TEXT;`);
        console.log("Column 'district' added (if not existed).");

        console.log("--- 2. Reading schools.csv and populating district ---");
        const csvPath = path.join(process.cwd(), 'public', 'schools.csv');
        const results = [];

        await new Promise((resolve, reject) => {
            fs.createReadStream(csvPath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Parsed ${results.length} schools from CSV.`);

        console.log("--- 3. Batch Updating district ---");
        // We update in batches for performance
        const BATCH_SIZE = 1000;
        let updated = 0;

        for (let i = 0; i < results.length; i += BATCH_SIZE) {
            const batch = results.slice(i, i + BATCH_SIZE);
            // We can do individual updates or a complex update FROM VALUES.
            // Individual concurrent updates are simpler to implement but slower. A transaction block helps.

            await client.query('BEGIN');
            const updatePromises = batch.map(row => {
                // Check if district exists in CSV row. It might be lowercase or Sentence case in header.
                const district = row.district || row.District || row.DISTRICT;
                if (district && row.school_id) {
                    return client.query(`UPDATE schools SET district = $1 WHERE school_id = $2`, [district, row.school_id]);
                }
                return Promise.resolve();
            });
            await Promise.all(updatePromises);
            await client.query('COMMIT');

            updated += batch.length;
            if (updated % 5000 === 0) console.log(`Processed ${updated} rows...`);
        }

        console.log("--- 4. Checking sample data ---");
        const sample = await client.query(`SELECT school_id, school_name, district, leg_district, municipality FROM schools LIMIT 5`);
        console.log(sample.rows);

        console.log("Done!");

    } catch (err) {
        console.error("Error:", err);
        await client.query('ROLLBACK');
    } finally {
        client.release();
        pool.end();
    }
}

run();
