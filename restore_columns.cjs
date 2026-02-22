const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DB_CONNECTION_STRING,
    ssl: false // The server does not support SSL
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
        console.log("Columns added successfully.");
    } catch (err) {
        console.error("Error adding columns:", err);
    } finally {
        pool.end();
    }
}

addColumnsBack();
