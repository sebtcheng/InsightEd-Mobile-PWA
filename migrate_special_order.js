import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const migrate = async () => {
    const client = await pool.connect();
    console.log("Connected to database...");

    try {
        console.log("Migrating pending_schools...");
        await client.query('ALTER TABLE "pending_schools" ADD COLUMN IF NOT EXISTS special_order TEXT');
        console.log("Added special_order to pending_schools");
    } catch (e) {
        console.error(`Failed pending_schools: ${e.message}`);
    }

    try {
        console.log("Migrating schools...");
        await client.query('ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS special_order TEXT');
        console.log("Added special_order to schools");
    } catch (e) {
        console.error(`Failed schools: ${e.message}`);
    }

    client.release();
    await pool.end();
    console.log("Migration finished.");
};

migrate();
