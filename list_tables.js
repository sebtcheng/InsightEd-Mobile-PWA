import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        console.log('Tables:');
        res.rows.forEach(r => console.log(r.table_name));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
};

run();
