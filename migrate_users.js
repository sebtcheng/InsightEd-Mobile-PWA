import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        console.log('Connecting to database...');

        // 1. Identify users to update
        // Criteria: Email ends with @deped.gov.ph AND locally part is numeric
        const checkQuery = `
            SELECT uid, email 
            FROM users 
            WHERE email ILIKE '%@deped.gov.ph' 
            AND SPLIT_PART(email, '@', 1) ~ '^[0-9]+$'
        `;

        const res = await pool.query(checkQuery);
        console.log(`Found ${res.rowCount} users to migrate.`);

        if (res.rowCount === 0) {
            console.log("No users match the criteria. Migration skipped.");
            return;
        }

        // 2. Perform Update
        // - Set alt_email = original email (only if alt_email is null/empty to avoid overwriting existing backups)
        // - Set email = local part (School ID)

        const updateQuery = `
            UPDATE users 
            SET 
                alt_email = COALESCE(NULLIF(alt_email, ''), email),
                email = SPLIT_PART(email, '@', 1)
            WHERE 
                email ILIKE '%@deped.gov.ph' 
                AND SPLIT_PART(email, '@', 1) ~ '^[0-9]+$'
            RETURNING uid, email, alt_email;
        `;

        const updateRes = await pool.query(updateQuery);

        console.log("Migration Successful!");
        console.log("Updated records:", updateRes.rows.map(r => ({
            id: r.uid,
            new_username: r.email,
            backup_email: r.alt_email
        })));

    } catch (err) {
        console.error('Migration Error:', err);
    } finally {
        await pool.end();
        console.log('Database connection closed.');
    }
};

run();
