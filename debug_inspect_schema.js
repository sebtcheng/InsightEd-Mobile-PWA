import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')) ? false : { rejectUnauthorized: false }
});

(async () => {
    try {
        await client.connect();

        const fs = await import('fs');
        const stream = fs.createWriteStream('schema_output.txt');

        // Get column names
        const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'teachers_list'
    `);

        stream.write("Columns in teachers_list:\n");
        res.rows.forEach(row => stream.write(row.column_name + "\n"));

        // Also select one row to verify data
        const data = await client.query('SELECT * FROM teachers_list LIMIT 1');
        stream.write("\nSample Row Keys:\n");
        Object.keys(data.rows[0]).forEach(key => stream.write(key + "\n"));

        stream.end();
        console.log("Schema written to schema_output.txt");

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
})();
