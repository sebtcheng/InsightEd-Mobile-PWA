
import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Manual .env parsing
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '');
        }
    });
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const client = await pool.connect();
        console.log('✅ Connected.');

        // 1. Check Row Count
        const resCount = await client.query('SELECT COUNT(*) FROM masterlist_26_30');
        console.log('Row Count:', resCount.rows[0].count);

        // 2. Check Sum Shortage
        // Try lowercase first (as per create table)
        try {
            const resSum = await client.query('SELECT SUM("estimated_classroom_shortage") as total FROM masterlist_26_30');
            console.log('Sum Shortage (lowercase col):', resSum.rows[0]);
        } catch (e) { console.log('Sum lowercase failed:', e.message); }

        // 3. Check Storey Breakdown
        try {
            const resBreakdown = await client.query(`
            SELECT "sty", "cl", COUNT(*) as count 
            FROM masterlist_26_30 
            WHERE "sty" IS NOT NULL 
            GROUP BY "sty", "cl" 
            ORDER BY "sty", "cl"
        `);
            console.log('Breakdown Data:', JSON.stringify(resBreakdown.rows, null, 2));
        } catch (e) { console.log('Breakdown query failed:', e.message); }

        client.release();
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        pool.end();
    }
}

run();
