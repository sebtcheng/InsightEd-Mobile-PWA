
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const verifySchool = async () => {
    const client = await pool.connect();
    console.log("🔌 Connected to Database");

    try {
        // 1. Check Table Existence
        const tableRes = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'schools'
            );
        `);
        console.log("Details on 'schools' table:", tableRes.rows[0]);

        if (!tableRes.rows[0].exists) {
            console.error("❌ Table 'schools' does NOT exist!");
            return;
        }

        // 2. Count Rows
        const countRes = await client.query('SELECT COUNT(*) FROM schools');
        console.log(`📊 Total Schools: ${countRes.rows[0].count}`);

        // 3. Check for Specific IDs
        const idsToCheck = ['100001', '123456'];
        for (const id of idsToCheck) {
            const res = await client.query('SELECT * FROM schools WHERE school_id = $1', [id]);
            if (res.rows.length > 0) {
                console.log(`✅ Found ID ${id}:`, res.rows[0].school_name);
            } else {
                console.log(`❌ ID ${id} NOT FOUND in DB.`);
            }
        }

        // 4. List first 5 schools to verify data
        const listRes = await client.query('SELECT school_id, school_name FROM schools LIMIT 5');
        console.log("\nSample Data (First 5):");
        console.table(listRes.rows);

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        client.release();
        pool.end();
    }
};

verifySchool();
