
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const debugIds = async () => {
    try {
        console.log("--- SCHOOL PROFILES ---");
        const schools = await pool.query('SELECT school_id, school_name, submitted_by FROM school_profiles');
        schools.rows.forEach(r => {
            console.log(`ID: "${r.school_id}" | Name: ${r.school_name} | User: ${r.submitted_by}`);
        });

        console.log("\n--- ENGINEER PROJECTS ---");
        const projects = await pool.query('SELECT project_id, school_id, school_name, project_name FROM engineer_form');
        projects.rows.forEach(r => {
            console.log(`ProjID: ${r.project_id} | SchoolID: "${r.school_id}" | SchoolName: ${r.school_name} | ProjName: ${r.project_name}`);
        });

    } catch (err) {
        console.error("Debug Error:", err);
    } finally {
        pool.end();
    }
};

debugIds();
