
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkRecentLogs() {
    try {
        // Look for our specific debug project or just recent ones
        const res = await pool.query(`
        SELECT action_type, target_entity, user_name, timestamp 
        FROM activity_logs 
        ORDER BY timestamp DESC 
        LIMIT 5
    `);
        console.log("--- Recent Log Entries ---");
        res.rows.forEach(r => {
            console.log(`[${new Date(r.timestamp).toISOString()}] ${r.action_type} - ${r.target_entity} (${r.user_name})`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkRecentLogs();
