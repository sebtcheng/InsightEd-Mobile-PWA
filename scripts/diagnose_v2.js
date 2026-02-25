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

    if (!dbUrl) {
        console.error("No DATABASE_URL found");
        return;
    }

    const pool = new Pool({ connectionString: dbUrl });

    try {
        const regionName = 'Region II';
        console.log(`--- Diagnosing ${regionName} ---`);

        // 1. Find all schools that are LIKE Region II but not EXACTLY Region II
        const variations = await pool.query(`
        SELECT region, COUNT(*) 
        FROM schools 
        WHERE region ILIKE '%Region II%' OR region ILIKE '%Region 2%'
        GROUP BY region
    `);
        console.log("Region variations in schools table:");
        console.table(variations.rows);

        // 2. Check total count with ILIKE
        const totalWithIlike = await pool.query(`
        SELECT COUNT(*) FROM schools 
        WHERE region ILIKE '%Region II%' OR region ILIKE '%Region 2%'
    `);
        console.log(`Total schools with ILIKE: ${totalWithIlike.rows[0].count}`);

        // 3. Check for duplicates
        const dupes = await pool.query(`
        SELECT school_id, COUNT(*) 
        FROM schools 
        GROUP BY school_id 
        HAVING COUNT(*) > 1
    `);
        if (dupes.rows.length > 0) {
            console.log("Duplicate school_ids found in schools table:");
            console.table(dupes.rows);
        } else {
            console.log("No duplicate school_ids in schools table.");
        }

        // 4. Check registered heads
        const heads = await pool.query(`
        SELECT COUNT(*) FROM users 
        WHERE role = 'School Head' 
        AND (region ILIKE '%Region II%' OR region ILIKE '%Region 2%')
    `);
        console.log(`Registered School Heads count: ${heads.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

diagnose();
