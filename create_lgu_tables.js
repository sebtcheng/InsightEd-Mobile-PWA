import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        console.log('Creating lgu_forms table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lgu_forms (
                project_id SERIAL PRIMARY KEY,
                project_name TEXT,
                school_name TEXT,
                school_id TEXT,
                region TEXT,
                division TEXT,
                status TEXT,
                accomplishment_percentage INTEGER,
                status_as_of TIMESTAMP,
                target_completion_date TIMESTAMP,
                actual_completion_date TIMESTAMP,
                notice_to_proceed TIMESTAMP,
                contractor_name TEXT,
                project_allocation NUMERIC,
                batch_of_funds TEXT,
                other_remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                lgu_id TEXT,
                validation_status TEXT,
                validation_remarks TEXT,
                validated_by TEXT,
                ipc TEXT,
                lgu_name TEXT,
                latitude TEXT,
                longitude TEXT,
                pow_pdf TEXT,
                dupa_pdf TEXT,
                contract_pdf TEXT
            );
        `);
        console.log('lgu_forms table created.');

        console.log('Creating lgu_image table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lgu_image (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES lgu_forms(project_id),
                image_data TEXT,
                uploaded_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('lgu_image table created.');

    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        await pool.end();
    }
};

run();
