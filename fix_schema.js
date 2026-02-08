import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
    console.log('🔧 Fixing pending_schools schema...');

    try {
        // 1. Drop the table
        await pool.query('DROP TABLE IF EXISTS pending_schools');
        console.log('✅ Dropped old pending_schools table.');

        // 2. Recreate with full schema from db_init.js
        await pool.query(`
        CREATE TABLE pending_schools (
            pending_id SERIAL PRIMARY KEY,
            
            -- School Information
            school_id TEXT UNIQUE NOT NULL,
            school_name TEXT NOT NULL,
            region TEXT NOT NULL,
            division TEXT NOT NULL,
            district TEXT,
            province TEXT,
            municipality TEXT,
            leg_district TEXT, -- Added
            barangay TEXT,
            street_address TEXT,
            mother_school_id TEXT,
            curricular_offering TEXT,
            
            -- Location Data
            latitude NUMERIC(10, 7),
            longitude NUMERIC(10, 7),
            
            -- Submission Metadata
            submitted_by TEXT NOT NULL,
            submitted_by_name TEXT,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Approval Status
            status TEXT DEFAULT 'pending',
            reviewed_by TEXT,
            reviewed_by_name TEXT,
            reviewed_at TIMESTAMP,
            rejection_reason TEXT
        );
    `);
        console.log('✅ Recreated pending_schools with correct schema.');

    } catch (err) {
        console.error('❌ Schema Fix Failed:', err);
    } finally {
        await pool.end();
    }
}

fixSchema();
