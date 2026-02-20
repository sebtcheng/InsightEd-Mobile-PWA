
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Manually load .env
try {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('No .env file found or error loading it');
}


const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    try {
        const client = await pool.connect();
        console.log('Using DB URL:', process.env.DATABASE_URL ? 'Loaded' : 'Default');
        console.log('Connected to DB');

        // Check actual column names
        const cols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'masterlist_26_30'
    `);
        console.log('Columns:', cols.rows.map(r => r.column_name));

        // Try Sum 1 (lowercase)
        try {
            const resSum = await client.query('SELECT SUM("estimated_classroom_shortage") as total FROM masterlist_26_30');
            console.log('Total Shortage Sum (lowercase):', resSum.rows[0]);
        } catch (e) { console.log('Sum query (lowercase) failed:', e.message); }

        // Try Sum 2 (Mixed Case)
        try {
            const resSumCaps = await client.query('SELECT SUM("Estimated Classroom Shortage") as total FROM masterlist_26_30');
            console.log('Total Shortage Sum (Mixed Case):', resSumCaps.rows[0]);
        } catch (e) { console.log('Sum query (Mixed Case) failed:', e.message); }

        // Try Storey
        try {
            const resSty = await client.query('SELECT DISTINCT "STY", "CL" FROM masterlist_26_30 WHERE "STY" IS NOT NULL ORDER BY "STY", "CL"');
            console.log('Distinct Storey/CL combinations (STY/CL caps):', resSty.rows);
        } catch (e) { console.log('Storey query failed:', e.message); }

        // Try Storey (lowercase)
        try {
            const resStyLower = await client.query('SELECT DISTINCT "sty", "cl" FROM masterlist_26_30 WHERE "sty" IS NOT NULL ORDER BY "sty", "cl"');
            console.log('Distinct Storey/CL combinations (lowercase):', resStyLower.rows);
        } catch (e) { console.log('Storey query (lowercase) failed:', e.message); }


        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkData();
