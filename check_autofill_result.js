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
        const schoolId = '108607';

        // Check if teachers were auto-filled
        const res = await client.query('SELECT COUNT(*) FROM teacher_specialization_details WHERE school_id = $1', [schoolId]);
        console.log(`Teachers auto-filled for ${schoolId}: ${res.rows[0].count}`);

        if (parseInt(res.rows[0].count) > 0) {
            console.log("✅ Auto-Fill Verification Successful!");
            // Verify a sample record
            const sample = await client.query('SELECT * FROM teacher_specialization_details WHERE school_id = $1 LIMIT 1', [schoolId]);
            console.log("Sample Record:", sample.rows[0]);
        } else {
            console.log("❌ Auto-Fill Failed (Count is 0).");
            // Check if there were teachers to copy in the first place
            const sourceCheck = await client.query('SELECT COUNT(*) FROM teachers_list WHERE "school.id" = $1', [schoolId]); // Using dot notation as per previous findings
            console.log(`Source Count in teachers_list for ${schoolId}: ${sourceCheck.rows[0].count}`);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
})();
