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

        console.log(`Running auto-fill query for school ${schoolId}...`);

        const query = `
            INSERT INTO teacher_specialization_details (
                iern, control_num, school_id, full_name, position, position_group, 
                specialization, teaching_load, created_at, updated_at
            )
            SELECT 
                "iern", 
                "control_num", 
                "school.id", 
                TRIM(CONCAT("first.name", ' ', "middle.name", ' ', "last.name")), 
                "position", 
                "position.group", 
                "specialization.final", 
                0, 
                NOW(), 
                NOW()
            FROM teachers_list 
            WHERE "school.id" = $1
            ON CONFLICT (control_num) DO NOTHING
    `;

        const res = await client.query(query, [schoolId]);
        console.log(`Query successful! Rows affected: ${res.rowCount}`);

    } catch (err) {
        console.error("❌ Query Failed:", err.message);
        if (err.position) console.error("Error Position:", err.position);
        if (err.hint) console.error("Hint:", err.hint);
    } finally {
        await client.end();
    }
})();
