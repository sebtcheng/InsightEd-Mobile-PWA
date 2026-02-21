import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';

dotenv.config();

const { Pool } = pg;

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
    try {
        let envContent = fs.readFileSync('.env', 'utf16le');
        let match = envContent.match(/DATABASE_URL=(.+)/);
        if (!match) {
            envContent = fs.readFileSync('.env', 'utf8');
            match = envContent.match(/DATABASE_URL=(.+)/);
        }
        if (match) {
            dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
        }
    } catch (e) {
        console.error("⚠️ Failed to parse .env:", e.message);
    }
}

const defaultLocal = 'postgres://postgres:password@localhost:5432/postgres';
if (!dbUrl) dbUrl = defaultLocal;

const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

console.log(`🔌 Connecting to: ${isLocal ? 'Local' : 'Remote'}`);

const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function addColumnsBack() {
    try {
        const query = `
      ALTER TABLE school_profiles
      ADD COLUMN IF NOT EXISTS data_health_score FLOAT DEFAULT 100,
      ADD COLUMN IF NOT EXISTS data_health_description TEXT,
      ADD COLUMN IF NOT EXISTS forms_to_recheck TEXT,
      ADD COLUMN IF NOT EXISTS completeness_issues TEXT,
      ADD COLUMN IF NOT EXISTS multivariate_flag TEXT,
      ADD COLUMN IF NOT EXISTS univariate_flags TEXT,
      ADD COLUMN IF NOT EXISTS school_head_validation BOOLEAN DEFAULT FALSE;
    `;
        await pool.query(query);
        console.log("✅ Columns added successfully to school_profiles.");
    } catch (err) {
        console.error("❌ Error adding columns:", err);
    } finally {
        pool.end();
    }
}

addColumnsBack();
