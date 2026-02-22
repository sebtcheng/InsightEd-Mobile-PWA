import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
}

const pool = new pg.Pool({
    connectionString: dbUrl || 'postgres://postgres:password@localhost:5432/postgres',
    ssl: dbUrl && dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function verify() {
    try {
        const res = await pool.query('SELECT SUM(proposed_no_of_classrooms) as total FROM masterlist_26_30');
        console.log('Database Sum Verification:');
        console.log('Total Classrooms:', res.rows[0].total);
        process.exit(0);
    } catch (err) {
        console.error('Verification Error:', err.message);
        process.exit(1);
    }
}

verify();
