import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';

async function diagnose() {
    let dbUrl;
    if (fs.existsSync('.env')) {
        try {
            const envContent = fs.readFileSync('.env', 'utf8');
            const match = envContent.match(/DATABASE_URL=(.+)/);
            if (match) dbUrl = match[1].trim().replace(/^[\'\"]|[\'\"]$/g, '');
        } catch (e) { }
    }

    const pool = new Pool({ connectionString: dbUrl });

    try {
        const region = 'Region II';

        console.log(`--- Diagnosing ${region} ---`);

        // 1. Unique Region Names
        const regions = await pool.query("SELECT DISTINCT region FROM schools WHERE region ILIKE '%Region II%'");
        console.log("Unique region names in schools:", regions.rows);

        // 2. Total Schools Count Variations
        const count1 = await pool.query("SELECT COUNT(*) FROM schools WHERE TRIM(region) = $1", [region]);
        const count2 = await pool.query("SELECT COUNT(*) FROM schools WHERE region ILIKE $1", [`%${region}%`]);
        const count3 = await pool.query("SELECT COUNT(DISTINCT school_id) FROM schools WHERE TRIM(region) = $1", [region]);

        console.log(`Schools (TRIM): ${count1.rows[0].count}`);
        console.log(`Schools (ILIKE %...%): ${count2.rows[0].count}`);
        console.log(`Unique Schools (TRIM): ${count3.rows[0].count}`);

        // 3. User Registration Count
        const userCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'School Head' AND TRIM(region) = $1", [region]);
        console.log(`Registered School Heads (TRIM): ${userCount.rows[0].count}`);

        // 4. Check for Duplicates in school_profiles or school_summary
        const profileDupes = await pool.query("SELECT school_id, COUNT(*) FROM school_profiles GROUP BY school_id HAVING COUNT(*) > 1");
        console.log(`Duplicate profiles found: ${profileDupes.rowCount}`);

        const summaryDupes = await pool.query("SELECT school_id, COUNT(*) FROM school_summary GROUP BY school_id HAVING COUNT(*) > 1");
        console.log(`Duplicate summaries found: ${summaryDupes.rowCount}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

diagnose();
