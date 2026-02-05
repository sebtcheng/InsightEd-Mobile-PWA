import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
    },
});

async function checkTable() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB.");

        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'project_documents';
        `);

        if (res.rows.length > 0) {
            console.log("✅ Table 'project_documents' EXISTS.");
            // Check columns
            const cols = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'project_documents';
            `);
            console.log(JSON.stringify(cols.rows, null, 2));
        } else {
            console.log("❌ Table 'project_documents' DOES NOT EXIST.");
        }

        client.release();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

checkTable();
