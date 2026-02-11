import dotenv from 'dotenv';
import pg from 'pg';
import admin from 'firebase-admin';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        const serviceAccount = require("../api/service-account.json");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized");
    } catch (e) {
        console.error("Firebase Init Error:", e.message);
    }
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    console.log("\n--- DEBUGGING AUTH LOOKUP with FIREBASE ---");
    const schoolId = '300425';

    // 1. Check SQL USERS
    console.log(`\n[SQL] Checking USERS table for ${schoolId}@% ...`);
    const usersRes = await pool.query(
        "SELECT uid, email, role FROM users WHERE email ILIKE $1",
        [`${schoolId}@%`]
    );
    console.log("SQL Users Found:", JSON.stringify(usersRes.rows, null, 2));

    // 2. Check SQL SCHOOL_PROFILES
    console.log(`\n[SQL] Checking SCHOOL_PROFILES table for ${schoolId}...`);
    const spRes = await pool.query(
        "SELECT submitted_by, email FROM school_profiles WHERE school_id = $1",
        [schoolId]
    );
    console.log("SQL School Profiles Found:", JSON.stringify(spRes.rows, null, 2));

    // 3. Check FIREBASE AUTH
    console.log(`\n[Firebase] Checking Auth for ${schoolId}@insighted.app ...`);
    try {
        const userRecord = await admin.auth().getUserByEmail(`${schoolId}@insighted.app`);
        console.log("✅ Firebase User Found:", userRecord.uid, userRecord.email);
    } catch (e) {
        console.log("❌ Firebase User Not Found:", e.code);
    }

    console.log(`\n[Firebase] Checking Auth for ${schoolId}@deped.gov.ph ...`);
    try {
        const user = await admin.auth().getUserByEmail(`${schoolId}@deped.gov.ph`);
        console.log("✅ Firebase User Found:", user.uid, user.email);
    } catch (e) {
        console.log("❌ Firebase User Not Found:", e.code);
    }

    await pool.end();
}

check().catch(console.error);
