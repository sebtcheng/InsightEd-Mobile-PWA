import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')) ? false : { rejectUnauthorized: false }
});

(async () => {
    try {
        await client.connect();
        // Get a school_id that has teachers but is NOT yet in school_profiles (if possible) 
        // or just any school_id to test the look up. 
        // The registration endpoint fails if school_id already exists in school_profiles.
        // So we need a school_id from teachers_list that is NOT in school_profiles.

        // Check if teachers_list exists first
        const checkTable = await client.query("SELECT to_regclass('public.teachers_list')");
        if (!checkTable.rows[0].to_regclass) {
            console.log("teachers_list table does not exist. Skipping.");
            return;
        }

        // Find a candidate
        const res = await client.query(`
        SELECT t."school.id" as school_id 
        FROM teachers_list t
        LEFT JOIN school_profiles sp ON CAST(t."school.id" AS TEXT) = sp.school_id
        WHERE sp.school_id IS NULL
        LIMIT 1
    `);

        // Note: I am using "school.id" because previous tools hinted at dot notation for columns, 
        // but I might need to adjust if column is just school_id.
        // Let's try standard school_id first if the above fails or just select * limit 1 to see formatting.
        // Actually, I'll just select one from teachers_list and append a random suffix if I need to simulate a new school 
        // BUT auto-fill needs EXACT match.
        // So I MUST find a school_id that exists in teachers_list.
        // And to register it, it must NOT exist in school_profiles.

        if (res.rows.length > 0) {
            console.log(`Found candidate School ID: ${res.rows[0].school_id}`);
        } else {
            console.log("No partial match found (all schools in teachers_list might already be registered or table empty).");
            // Fallback: Get ANY school_id from teachers_list
            const anyRes = await client.query('SELECT "school.id" FROM teachers_list LIMIT 1');
            if (anyRes.rows.length > 0) console.log(`Fallback School ID (might be registered): ${anyRes.rows[0]["school.id"]}`);
        }

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
})();
