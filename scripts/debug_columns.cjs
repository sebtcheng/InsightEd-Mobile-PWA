
console.log("STARTING SCRIPT");
try {
    const fs = require('fs');
    console.log("FS Loaded");
    require('dotenv').config();
    console.log("Dotenv Loaded");
    const { Pool } = require('pg');
    console.log("PG Loaded");

    // Check Env
    console.log("DB URL Length:", (process.env.DATABASE_URL || '').length);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    pool.connect().then(client => {
        console.log("Connected!");
        client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'masterlist_26_30'`)
            .then(res => {
                console.log("COLUMNS:", JSON.stringify(res.rows));
                client.release();
                pool.end();
            })
            .catch(e => {
                console.error("Query Error:", e);
                pool.end();
            });
    }).catch(e => {
        console.error("Connection Error:", e);
        pool.end();
    });

} catch (e) {
    console.error("Top Level Error:", e);
}
