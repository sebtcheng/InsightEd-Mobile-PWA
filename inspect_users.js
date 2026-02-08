import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        `);
        console.log('Columns:', res.rows.map(r => `${r.column_name} (${r.data_type})`));

        // Also get sample data where username looks like an email
        const sampleRes = await pool.query(`
            SELECT * FROM users 
            WHERE username ILIKE '%@deped.gov.ph' 
            LIMIT 5
        `);
        console.log('Sample users with email-like usernames:', sampleRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
};

run();
