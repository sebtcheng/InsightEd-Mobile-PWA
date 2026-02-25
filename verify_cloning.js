import pg from 'pg';
import fs from 'fs';

let dbUrl;
try {
    const raw = fs.readFileSync('.env');
    let content;
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
        content = raw.toString('utf16le');
    } else {
        content = raw.toString('utf8');
    }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        if (line.trim().startsWith('DATABASE_URL=')) {
            dbUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
            break;
        }
    }
} catch (e) {
    console.error("Error reading .env:", e);
    process.exit(1);
}

let efdUrl;
try {
    const u = new URL(dbUrl);
    u.pathname = '/efd';
    efdUrl = u.toString();
} catch (e) {
    efdUrl = dbUrl.replace(/\/([^/?]+)(\?|$)/, '/efd$2');
}

const { Pool } = pg;
const insightedPool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

const efdPool = new Pool({
    connectionString: efdUrl,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    try {
        const efdClient = await efdPool.connect();
        const insightedClient = await insightedPool.connect();

        console.log("--- Row Count Verification ---");
        const efdCountRes = await efdClient.query('SELECT COUNT(*) FROM nsbi_24_25_buildings');
        const insightedCountRes = await insightedClient.query('SELECT COUNT(*) FROM nsbi_24_25_buildings');

        const efdCount = efdCountRes.rows[0].count;
        const insightedCount = insightedCountRes.rows[0].count;

        console.log(`EFD Row Count: ${efdCount}`);
        console.log(`INSIGHTED Row Count: ${insightedCount}`);

        if (efdCount === insightedCount) {
            console.log("✅ Row counts match!");
        } else {
            console.log("❌ Row count mismatch!");
        }

        console.log("\n--- Sample Data Verification (Checking 5 random rows) ---");
        // We compare specific columns from random rows to ensure they match
        // Note: Row order might differ, so we'll fetch by school_id and building_code if they exist
        const samples = await insightedClient.query('SELECT * FROM nsbi_24_25_buildings LIMIT 5');

        for (const row of samples.rows) {
            console.log(`Checking School ID: ${row.school_id}, Building Code: ${row.building_code}`);
            const efdRowRes = await efdClient.query(
                'SELECT * FROM nsbi_24_25_buildings WHERE school_id = $1 AND COALESCE(building_code, \'\') = COALESCE($2, \'\') AND COALESCE(building_no, \'\') = COALESCE($3, \'\') LIMIT 1',
                [row.school_id, row.building_code, row.building_no]
            );

            if (efdRowRes.rows.length > 0) {
                const efdRow = efdRowRes.rows[0];
                // Check a few key fields
                const match = row.building_type === efdRow.building_type &&
                    row.number_of_rooms === efdRow.number_of_rooms;

                if (match) {
                    console.log(`  ✅ Match found in EFD!`);
                } else {
                    console.log(`  ❌ Data mismatch for this row!`);
                    console.log(`     EFD: ${efdRow.building_type}, rooms: ${efdRow.number_of_rooms}`);
                    console.log(`     INSIGHTED: ${row.building_type}, rooms: ${row.number_of_rooms}`);
                }
            } else {
                console.log(`  ❌ Row NOT found in EFD! (This is unexpected)`);
            }
        }

        efdClient.release();
        insightedClient.release();
    } catch (e) {
        console.error("Error during verification:", e);
    } finally {
        await efdPool.end();
        await insightedPool.end();
    }
}

verify();
