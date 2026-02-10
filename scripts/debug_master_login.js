import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    // Check school_profiles for 300425
    const sp = await pool.query(
        "SELECT submitted_by, email FROM school_profiles WHERE school_id = $1",
        ['300425']
    );
    console.log("school_profiles result:", JSON.stringify(sp.rows, null, 2));

    // Check users table
    const u = await pool.query(
        "SELECT uid, email, role FROM users WHERE email LIKE $1",
        ['300425@%']
    );
    console.log("users result:", JSON.stringify(u.rows, null, 2));

    await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
