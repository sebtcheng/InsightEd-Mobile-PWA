
import pg from 'pg';
import fs from 'fs';

// Robust .env parsing
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
    try {
        const envContent = fs.readFileSync('.env', 'utf8');
        const match = envContent.match(/DATABASE_URL=(.+)/);
        if (match) dbUrl = match[1].trim().replace(/^'|^"|'$|"$/g, '');
    } catch (err) { }
}

if (!dbUrl) {
    console.error("DATABASE_URL not found!");
    process.exit(1);
}

const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    try {
        const region = 'Region II'; // Example Region

        // 1. Manual Query
        const userRes = await pool.query(`
        SELECT COUNT(*) FROM users 
        WHERE role = 'School Head' 
        AND TRIM(region) = TRIM($1)
    `, [region]);
        const manualCount = parseInt(userRes.rows[0].count);
        console.log(`Manual DB Count for ${region}: ${manualCount}`);

        // 2. API SQL Logic
        const statsRes = await pool.query(`
      SELECT 
        COUNT(s.school_id) as total_schools,
        (
            SELECT COUNT(*) FROM users u 
            WHERE u.role = 'School Head' 
            AND TRIM(u.region) = TRIM(s.region)
        ) as registered_heads_count
      FROM schools s
      WHERE TRIM(s.region) = TRIM($1)
      GROUP BY s.region
    `, [region]);

        if (statsRes.rows.length === 0) {
            console.log("No schools found for this region in 'schools' table.");
        } else {
            const apiCount = parseInt(statsRes.rows[0].registered_heads_count);
            console.log(`API SQL Count for ${region}: ${apiCount}`);

            if (manualCount === apiCount) {
                console.log("✅ SUCCESS: Counts match!");
            } else {
                console.log("❌ FAILURE: Counts do not match!");
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

verify();
