
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    try {
        const client = await pool.connect();
        console.log('Connected to DB');

        // Check actual column names first
        const cols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'masterlist_26_30'
    `);
        console.log('Columns:', cols.rows.map(r => r.column_name));

        try {
            const resSum = await client.query('SELECT SUM("estimated_classroom_shortage") as total FROM masterlist_26_30');
            console.log('Total Shortage Sum (lowercase):', resSum.rows[0]);
        } catch (e) { console.log('Sum query (lowercase) failed:', e.message); }

        try {
            const resSumCaps = await client.query('SELECT SUM("Estimated Classroom Shortage") as total FROM masterlist_26_30');
            console.log('Total Shortage Sum (Mixed Case):', resSumCaps.rows[0]);
        } catch (e) { console.log('Sum query (Mixed Case) failed:', e.message); }

        try {
            const resSty = await client.query('SELECT DISTINCT "STY", "CL" FROM masterlist_26_30 WHERE "STY" IS NOT NULL ORDER BY "STY", "CL"');
            console.log('Distinct Storey/CL combinations (STY/CL caps):', resSty.rows);
        } catch (e) { console.log('Storey query failed:', e.message); }


        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkData();
