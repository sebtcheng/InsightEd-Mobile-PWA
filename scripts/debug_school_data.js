import dotenv from 'dotenv';
import pg from 'pg';
import admin from 'firebase-admin';
import fs from 'fs';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

dotenv.config();

if (!admin.apps.length) {
    try {
        const serviceAccount = require("../api/service-account.json");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) { }
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    const output = [];
    const log = (msg) => output.push(msg);

    log("--- DEBUG OUTPUT ---");
    const schoolId = '112092';

    // 1. Sample
    try {
        const sampleRes = await pool.query("SELECT school_id, school_name FROM school_profiles LIMIT 3");
        log("Sample Schools: " + JSON.stringify(sampleRes.rows));
    } catch (e) { log("Error fetching samples: " + e.message); }

    // 2. Specific School
    try {
        const spRes = await pool.query("SELECT * FROM school_profiles WHERE school_id = $1", [schoolId]);
        if (spRes.rows.length === 0) {
            log(`❌ School ${schoolId} NOT FOUND in DB.`);
        } else {
            log(`✅ School ${schoolId} FOUND. Owner: ${spRes.rows[0].submitted_by}`);
        }
    } catch (e) { log("Error fetching school: " + e.message); }

    // 3. Firebase Match
    try {
        const user = await admin.auth().getUserByEmail(`${schoolId}@insighted.app`);
        log(`Firebase User (${schoolId}@insighted.app): ${user.uid}`);
    } catch (e) {
        log(`Firebase User (${schoolId}@insighted.app) NOT FOUND.`);
    }

    await pool.end();
    fs.writeFileSync('debug_output.txt', output.join('\n'));
    console.log("Debug complete. Written to debug_output.txt");
}

check().catch(e => {
    fs.writeFileSync('debug_output.txt', "Global Error: " + e.message);
});
