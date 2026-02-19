import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')) ? false : { rejectUnauthorized: false }
});

const createTeacherTable = async () => {
    try {
        console.log("🚀 Creating teacher_specialization_details table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teacher_specialization_details (
                id SERIAL PRIMARY KEY,
                iern VARCHAR(255),
                control_num VARCHAR(255) UNIQUE NOT NULL,
                school_id VARCHAR(255),
                full_name VARCHAR(255),
                position VARCHAR(255),
                position_group VARCHAR(255),
                specialization VARCHAR(255),
                teaching_load DECIMAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_teacher_iern ON teacher_specialization_details(iern);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_teacher_school_id ON teacher_specialization_details(school_id);`);

        console.log("✅ teacher_specialization_details table created successfully!");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    } finally {
        await pool.end();
    }
};

createTeacherTable();
