import dotenv from 'dotenv';
import express from 'express';
import pg from 'pg';
import cors from 'cors';
// import cron from 'node-cron'; // REMOVED for Vercel
import admin from 'firebase-admin'; // --- FIREBASE ADMIN ---
import nodemailer from 'nodemailer'; // --- NODEMAILER ---
import { initOtpTable, runMigrations } from './db_init.js';

import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from "module"; // Added for JSON import
const require = createRequire(import.meta.url);

// Load environment variables11111111111111
dotenv.config();

// --- EMAIL TRANSPORTER ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Destructure Pool from pg
const { Pool } = pg;

// --- STATE ---
let isDbConnected = false;

const app = express();




// --- AUTH MIDDLEWARE ---
app.use(cors({
  origin: [
    'http://localhost:5173',           // Vite Local Default
    'http://localhost:5174',           // Vite Local Alternate
    'https://insight-ed-mobile-pwa.vercel.app', // Your Vercel Frontend
    'https://insight-ed-frontend.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '50mb' }));

// --- DATABASE CONNECTION ---
const isLocal = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

// --- SECONDARY DATABASE CONNECTION (Dual-Write) ---
let poolNew = null;
if (process.env.NEW_DATABASE_URL) {
  console.log('ðŸ”Œ Initializing Secondary Database Connection...');
  poolNew = new Pool({
    connectionString: process.env.NEW_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Test Connection
  poolNew.connect()
    .then(client => {
      console.log('âœ… Connected to Secondary Database (ICTS) successfully!');
      client.release();
    })
    .catch(err => console.error('âŒ Failed to connect to Secondary Database:', err.message));
}

// --- DATABASE INIT ---
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_documents (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES engineer_form(project_id),
        doc_type TEXT NOT NULL, -- 'POW', 'DUPA', 'CONTRACT'
        file_data TEXT, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- MIGRATION: ADD PDF COLUMNS & engineer_id TO ENGINEER_FORM IF NOT EXIST ---
    await pool.query(`
      ALTER TABLE engineer_form 
      ADD COLUMN IF NOT EXISTS pow_pdf TEXT,
      ADD COLUMN IF NOT EXISTS dupa_pdf TEXT,
      ADD COLUMN IF NOT EXISTS contract_pdf TEXT,
      ADD COLUMN IF NOT EXISTS engineer_id TEXT;
    `);

    // --- MIGRATION: ADD FRAUD DETECTION COLUMNS TO SCHOOL_PROFILES ---
    await pool.query(`
      ALTER TABLE school_profiles
      ADD COLUMN IF NOT EXISTS school_head_validation BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS data_health_score FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS data_health_description TEXT,
      ADD COLUMN IF NOT EXISTS forms_to_recheck TEXT;
    `);
    console.log("✅ DB Init: Schema verified (project_documents + engineer_form PDF cols + engineer_id).");

    // --- MIGRATION: LGU FORMS AND IMAGES ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lgu_forms (
        project_id SERIAL PRIMARY KEY,
        project_name TEXT, 
        school_name TEXT, 
        school_id TEXT, 
        region TEXT, 
        division TEXT,
        status TEXT, 
        accomplishment_percentage INTEGER, 
        status_as_of TIMESTAMP,
        target_completion_date TIMESTAMP, 
        actual_completion_date TIMESTAMP, 
        notice_to_proceed TIMESTAMP,
        contractor_name TEXT, 
        project_allocation NUMERIC, 
        batch_of_funds TEXT, 
        other_remarks TEXT,
        lgu_id TEXT, 
        ipc TEXT, 
        lgu_name TEXT, 
        latitude TEXT, 
        longitude TEXT,
        pow_pdf TEXT, 
        dupa_pdf TEXT, 
        contract_pdf TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
        ALTER TABLE lgu_forms
        ADD COLUMN IF NOT EXISTS moa_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS tranches_count INTEGER,
        ADD COLUMN IF NOT EXISTS tranche_amount NUMERIC,
        ADD COLUMN IF NOT EXISTS fund_source TEXT,
        ADD COLUMN IF NOT EXISTS province TEXT,
        ADD COLUMN IF NOT EXISTS city TEXT,
        ADD COLUMN IF NOT EXISTS municipality TEXT,
        ADD COLUMN IF NOT EXISTS legislative_district TEXT,
        ADD COLUMN IF NOT EXISTS scope_of_works TEXT,
        ADD COLUMN IF NOT EXISTS contract_amount NUMERIC,
        ADD COLUMN IF NOT EXISTS bid_opening_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS resolution_award_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS procurement_stage TEXT,
        ADD COLUMN IF NOT EXISTS bidding_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS awarding_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS construction_start_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS funds_downloaded NUMERIC,
        ADD COLUMN IF NOT EXISTS funds_utilized NUMERIC;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS lgu_image (
            id SERIAL PRIMARY KEY,
            project_id INT REFERENCES lgu_forms(project_id),
            image_data TEXT,
            uploaded_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log("✅ DB Init: LGU Schema verified (lgu_forms + extra columns + lgu_image).");



    // --- MIGRATION: ADD MISSING COLUMNS (CLASSROOMS, SITES, STOREYS, FUNDS) ---
    await pool.query(`
      ALTER TABLE engineer_form 
      ADD COLUMN IF NOT EXISTS number_of_classrooms INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS number_of_sites INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS number_of_storeys INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS funds_utilized NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS internal_description TEXT,
      ADD COLUMN IF NOT EXISTS external_description TEXT;
    `);
    console.log("✅ DB Init: Engineer Form extra columns verified.");

  } catch (err) {
    console.error("âŒ DB Init Error:", err);
  }
};
initDB();

// --- DEBUG: SCANNER ENDPOINT ---
app.get('/api/debug/scan/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    // 1. Get School Profile
    const spResult = await pool.query("SELECT * FROM school_profiles WHERE submitted_by = $1", [uid]);
    if (spResult.rows.length === 0) return res.json({ error: "No school profile found for this user." });

    const sp = spResult.rows[0];
    const report = { school_id: sp.school_id, school_name: sp.school_name, forms: {} };
    let completed = 0;

    // Verbose Checks (Mirroring calculateSchoolProgress)

    // F1
    report.forms.f1_profile = { passed: !!sp.school_name, val: sp.school_name, reason: sp.school_name ? "OK" : "Missing School Name" };
    if (report.forms.f1_profile.passed) completed++;

    // F2
    report.forms.f2_head = { passed: !!sp.head_last_name, val: sp.head_last_name, reason: sp.head_last_name ? "OK" : "Missing Head Last Name" };
    if (report.forms.f2_head.passed) completed++;

    // F3
    report.forms.f3_enrollment = { passed: (sp.total_enrollment > 0), val: sp.total_enrollment, reason: "Must be > 0" };
    if (report.forms.f3_enrollment.passed) completed++;

    // F4
    const totalClasses = (sp.classes_kinder || 0) + (sp.classes_grade_1 || 0) + (sp.classes_grade_2 || 0) + (sp.classes_grade_3 || 0) +
      (sp.classes_grade_4 || 0) + (sp.classes_grade_5 || 0) + (sp.classes_grade_6 || 0) +
      (sp.classes_grade_7 || 0) + (sp.classes_grade_8 || 0) + (sp.classes_grade_9 || 0) + (sp.classes_grade_10 || 0) +
      (sp.classes_grade_11 || 0) + (sp.classes_grade_12 || 0);
    report.forms.f4_classes = { passed: totalClasses > 0, val: totalClasses, reason: "Sum of classes must be > 0" };
    if (report.forms.f4_classes.passed) completed++;

    // F5
    const totalTeachers = (sp.teach_kinder || 0) + (sp.teach_g1 || 0) + (sp.teach_g2 || 0) + (sp.teach_g3 || 0) +
      (sp.teach_g4 || 0) + (sp.teach_g5 || 0) + (sp.teach_g6 || 0) +
      (sp.teach_g7 || 0) + (sp.teach_g8 || 0) + (sp.teach_g9 || 0) + (sp.teach_g10 || 0) +
      (sp.teach_g11 || 0) + (sp.teach_g12 || 0);
    report.forms.f5_teachers = { passed: totalTeachers > 0, val: totalTeachers, reason: "Sum of teachers must be > 0" };
    if (report.forms.f5_teachers.passed) completed++;

    // F6
    const specFields = [
      'spec_general_major', 'spec_ece_major', 'spec_english_major', 'spec_filipino_major', 'spec_math_major',
      'spec_science_major', 'spec_ap_major', 'spec_mapeh_major', 'spec_esp_major', 'spec_tle_major',
      'spec_bio_sci_major', 'spec_phys_sci_major', 'spec_agri_fishery_major', 'spec_others_major'
    ];
    const specVals = specFields.map(f => sp[f] || 0);
    const hasSpec = specVals.some(v => v > 0);
    report.forms.f6_specialization = { passed: hasSpec, max_val: Math.max(...specVals), reason: "Any specialization > 0" };
    if (report.forms.f6_specialization.passed) completed++;

    // F7
    const hasRes = (sp.res_electricity_source || sp.res_water_source || sp.res_buildable_space || sp.sha_category ||
      (sp.res_armchair_func || 0) > 0 || (sp.res_armchairs_good || 0) > 0 || (sp.res_toilets_male || 0) > 0);
    report.forms.f7_resources = { passed: !!hasRes, reason: "Utility/Infra set or Inventory > 0. Elec: " + sp.res_electricity_source };
    if (report.forms.f7_resources.passed) completed++;

    // F8
    report.forms.f8_facilities = { passed: (sp.build_classrooms_total > 0), val: sp.build_classrooms_total, reason: "Total Classrooms > 0" };
    if (report.forms.f8_facilities.passed) completed++;

    // F9
    const hasShift = (sp.shift_kinder || sp.shift_g1 || sp.adm_mdl || sp.adm_odl);
    report.forms.f9_shifting = { passed: !!hasShift, reason: "Any shift or modality set" };
    if (report.forms.f9_shifting.passed) completed++;

    // F10
    const statKeys = Object.keys(sp).filter(k => k.startsWith('stat_'));
    const nonZeroStats = statKeys.filter(k => Number(sp[k]) > 0);
    report.forms.f10_stats = {
      passed: nonZeroStats.length > 0,
      positive_keys: nonZeroStats,
      count: nonZeroStats.length,
      reason: "Any stat_ field > 0"
    };
    if (report.forms.f10_stats.passed) completed++;

    report.total_score = completed;
    report.percentage = Math.round((completed / 10) * 100);

    // AUTO-HEAL: If the calculation here differs from DB, update DB
    if (completed !== sp.forms_completed_count) {
      report.fix_applied = true;
      await calculateSchoolProgress(sp.school_id, pool); // Force trigger the main function
    }

    res.json(report);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// --- DEBUG: RECALCULATE ALL ENDPOINT ---
app.get('/api/debug/recalculate-all', async (req, res) => {
  try {
    console.log("ðŸ”„ Starting Full Snapshot Recalculation...");
    const result = await pool.query('SELECT school_id FROM school_profiles');
    const schools = result.rows;

    let count = 0;
    for (const s of schools) {
      if (s.school_id) {
        await calculateSchoolProgress(s.school_id, pool);
        count++;
      }
    }

    console.log(`âœ… Recalculation Complete for ${count} schools.`);
    res.json({
      success: true,
      message: `Recalculated progress for ${count} schools.`,
      count: count
    });

  } catch (err) {
    console.error("âŒ Backfill Error:", err);
    res.status(500).json({ error: "Backfill failed: " + err.message });
  }
});
// --- VERCEL CRON ENDPOINT (MOVED TO TOP) ---
// Support both /api/cron... (Local) and /cron... (Vercel)
app.get(['/api/cron/check-deadline', '/cron/check-deadline'], async (req, res) => {
  // 1. Security Check
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('â° Running Deadline Reminder (Vercel Cron)...');
  try {
    const settingRes = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'enrolment_deadline'");
    if (settingRes.rows.length === 0 || !settingRes.rows[0].setting_value) {
      return res.json({ message: 'No deadline set.' });
    }
    const deadlineVal = settingRes.rows[0].setting_value;
    const deadlineDate = new Date(deadlineVal);
    const now = new Date();
    const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));

    console.log(`ðŸ“… Deadline: ${deadlineVal}, Days Left: ${diffDays}`);

    // Check Criteria (0 to 3 days left)
    if (diffDays <= 3 && diffDays >= 0) {
      const tokenRes = await pool.query("SELECT fcm_token FROM user_device_tokens WHERE fcm_token IS NOT NULL");
      const tokens = tokenRes.rows.map(r => r.fcm_token);

      console.log(`Found ${tokens.length} device tokens.`);

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: diffDays === 0 ? "Deadline is TODAY!" : "Deadline Reminder",
            body: diffDays === 0
              ? "Submission closes today. Please finalize your reports."
              : `Submission is due in ${diffDays} day${diffDays > 1 ? 's' : ''}! Please finalize your forms.`
          },
          tokens: tokens
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          console.log(`ðŸš€ Notification Response: ${response.successCount} sent, ${response.failureCount} failed.`);
          if (response.failureCount > 0) {
            console.log("Failed details:", JSON.stringify(response.responses));
          }
          return res.json({ success: true, sent: response.successCount, failed: response.failureCount });
        } catch (sendErr) {
          console.error("Firebase Send Error:", sendErr);
          throw sendErr;
        }
      } else {
        console.log("â„¹ï¸ No tokens found in DB.");
        return res.json({ message: 'No device tokens found.' });
      }
    } else {
      console.log(`â„¹ï¸ Skipping: ${diffDays} days remaining (Not within 0-3 range).`);
      return res.json({ message: `Not within reminder window (0-3 days). Days: ${diffDays}` });
    }
  } catch (error) {
    console.error('âŒ Cron Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// --- POST: Save Device Token ---
app.post('/api/save-token', async (req, res) => {
  const { uid, token } = req.body;
  if (!uid || !token) return res.status(400).json({ error: "Missing uid or token" });

  try {
    await pool.query(`
            INSERT INTO user_device_tokens (uid, fcm_token, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (uid)
            DO UPDATE SET fcm_token = $2, updated_at = CURRENT_TIMESTAMP
        `, [uid, token]);

    // --- DUAL WRITE: SAVE DEVICE TOKEN ---
    if (poolNew) {
      poolNew.query(`
            INSERT INTO user_device_tokens (uid, fcm_token, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (uid)
            DO UPDATE SET fcm_token = $2, updated_at = CURRENT_TIMESTAMP
        `, [uid, token]).catch(e => console.error("Dual-Write Token Err:", e.message));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Save Token Error:", err);
    res.status(500).json({ error: "Failed to save token" });
  }
});

// --- FIREBASE ADMIN INIT ---
if (!admin.apps.length) {
  try {
    let credential;
    // 1. Try Environment Variable (Vercel Production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
      console.log("âœ… Firebase Admin Initialized from ENV");
    }
    // 2. Try Local File (Local Dev)
    else {
      try {
        const serviceAccount = require("./service-account.json");
        credential = admin.credential.cert(serviceAccount);
        console.log("âœ… Firebase Admin Initialized from Local File");
      } catch (fileErr) {
        console.warn("âš ï¸ No local service-account.json found.");
      }
    }

    if (credential) {
      admin.initializeApp({ credential });
    } else {
      console.warn("âš ï¸ Firebase Admin NOT initialized (Missing Credentials)");
    }
  } catch (e) {
    console.warn("âš ï¸ Firebase Admin Init Failed:", e.message);
  }
}

// Initialize OTP Table


const initOtpTable_OLD = async () => {
  if (!isDbConnected) {
    console.log("âš ï¸ Skipping OTP Table Init (Offline Mode)");
    return;
  }

  try {
    await pool.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                email VARCHAR(255) PRIMARY KEY,
                code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes')
            );
        `);
    console.log("âœ… OTP Table Initialized");
  } catch (err) {
    console.error("âŒ Failed to init OTP table:", err);
  }
};

// --- DATABASE CONNECTION ---
// Auto-connect and initialize
const old_db_init_disabled = async () => {
  try {
    const client = await pool.connect();
    isDbConnected = true;
    console.log('âœ… Connected to Postgres Database successfully!');
    await initOtpTable();

    try {
      // --- INIT NOTIFICATIONS TABLE ---
      try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_uid TEXT NOT NULL,
                sender_uid TEXT,
                sender_name TEXT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'alert',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('âœ… Notifications Table Initialized');
      } catch (tableErr) {
        console.error('âŒ Failed to init notifications table:', tableErr.message);
      }

      // --- MIGRATION: ADD EMAIL TO SCHOOL_PROFILES ---
      try {
        await client.query(`
            ALTER TABLE school_profiles 
            ADD COLUMN IF NOT EXISTS email TEXT;
        `);
        console.log('âœ… Checked/Added email column to school_profiles');
      } catch (migErr) {
        console.error('âŒ Failed to migrate school_profiles:', migErr.message);
      }

      // --- MIGRATION: USER DEVICE TOKENS ---
      try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_device_tokens (
                uid TEXT PRIMARY KEY,
                fcm_token TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('âœ… Checked/Created user_device_tokens table');
      } catch (tokenErr) {
        console.error('âŒ Failed to init user_device_tokens:', tokenErr.message);
      }

    } catch (err) {

      // --- MIGRATION: ADD CURRICULAR OFFERING ---
      try {
        await client.query(`
            ALTER TABLE school_profiles 
            ADD COLUMN IF NOT EXISTS curricular_offering TEXT;
        `);
        console.log('âœ… Checked/Added curricular_offering column to school_profiles');
      } catch (migErr) {
        console.error('âŒ Failed to migrate curricular_offering:', migErr.message);
      }

      // --- MIGRATION: EXTEND USERS TABLE (For Engineer/Generic Sync) ---
      try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                uid TEXT PRIMARY KEY,
                email TEXT,
                role TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                first_name TEXT,
                last_name TEXT,
                region TEXT,
                division TEXT,
                province TEXT,
                city TEXT,
                barangay TEXT,
                office TEXT,
                position TEXT,
                disabled BOOLEAN DEFAULT FALSE
            );
        `);
        // --- 1e. FORGOT PASSWORD (CUSTOM) ---

        // If table exists, ensure columns exist
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS first_name TEXT,
            ADD COLUMN IF NOT EXISTS last_name TEXT,
            ADD COLUMN IF NOT EXISTS region TEXT,
            ADD COLUMN IF NOT EXISTS division TEXT,
            ADD COLUMN IF NOT EXISTS province TEXT,
            ADD COLUMN IF NOT EXISTS city TEXT,
            ADD COLUMN IF NOT EXISTS barangay TEXT,
            ADD COLUMN IF NOT EXISTS office TEXT,
            ADD COLUMN IF NOT EXISTS position TEXT,
            ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;
        `);
        console.log('âœ… Checked/Extended users table schema');
      } catch (migErr) {
        console.error('âŒ Failed to migrate users table:', migErr.message);
      }
      // --- MIGRATION: ADD SCHOOL RESOURCES COLUMNS ---
      try {
        await client.query(`
        ALTER TABLE school_profiles 
        ADD COLUMN IF NOT EXISTS res_toilets_common INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sha_category TEXT;
      `);
        console.log('âœ… Checked/Added new School Resources columns');
      } catch (migErr) {
        console.error('âŒ Failed to migrate resources columns:', migErr.message);
      }

      // --- MIGRATION: COMPREHENSIVE FIX FOR MISSING COLUMNS ---
      try {
        await client.query(`
        ALTER TABLE school_profiles 
        -- Site & Utils
        ADD COLUMN IF NOT EXISTS res_electricity_source TEXT,
        ADD COLUMN IF NOT EXISTS res_buildable_space TEXT,
        ADD COLUMN IF NOT EXISTS res_water_source TEXT,
        
        -- Toilets & Labs
        ADD COLUMN IF NOT EXISTS res_toilets_pwd INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_sci_labs INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_com_labs INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_tvl_workshops INTEGER DEFAULT 0,

        -- Seats Analysis
        ADD COLUMN IF NOT EXISTS seats_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_12 INTEGER DEFAULT 0,

        -- Organized Classes (Counters)
        ADD COLUMN IF NOT EXISTS classes_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_12 INTEGER DEFAULT 0,

        -- Class Size Analysis
        ADD COLUMN IF NOT EXISTS cnt_less_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g12 INTEGER DEFAULT 0,

        -- Equipment Inventory
        ADD COLUMN IF NOT EXISTS res_ecart_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_ecart_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_laptop_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_laptop_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_tv_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_tv_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_printer_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_printer_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_desk_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_desk_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_armchair_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_armchair_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_toilet_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_toilet_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_handwash_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_handwash_nonfunc INTEGER DEFAULT 0;
      `);
        console.log('âœ… Checked/Added ALL missing School Resources & Class Analysis columns');
      } catch (migErr) {
        console.error('âŒ Failed to migrate extra columns:', migErr.message);
      }

      // --- MIGRATION: TEACHER SPECIALIZATION COLUMNS ---
      try {
        await client.query(`
        ALTER TABLE school_profiles 
        ADD COLUMN IF NOT EXISTS spec_english_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_english_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_filipino_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_filipino_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_math_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_math_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_science_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_science_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ap_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ap_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_mapeh_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_mapeh_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_esp_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_esp_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_tle_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_tle_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_guidance INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_librarian INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ict_coord INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_drrm_coord INTEGER DEFAULT 0,
        -- General Education for Elementary
        ADD COLUMN IF NOT EXISTS spec_general_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_general_teaching INTEGER DEFAULT 0,
        -- New Elementary Field
        ADD COLUMN IF NOT EXISTS spec_ece_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ece_teaching INTEGER DEFAULT 0,
        -- New Secondary Fields
        ADD COLUMN IF NOT EXISTS spec_bio_sci_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_bio_sci_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_phys_sci_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_phys_sci_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_agri_fishery_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_agri_fishery_teaching INTEGER DEFAULT 0,
        -- New Others Field
        ADD COLUMN IF NOT EXISTS spec_others_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_others_teaching INTEGER DEFAULT 0;
      `);
        console.log('âœ… Checked/Added Teacher Specialization columns');
      } catch (migErr) {
        console.error('âŒ Failed to migrate specialization columns:', migErr.message);
      }

      // --- MIGRATION: ADD IPC COLUMN TO ENGINEER FORM ---
      try {
        // First ensure the table exists (it should, but safety first)
        await client.query(`
            CREATE TABLE IF NOT EXISTS engineer_form (
                project_id SERIAL PRIMARY KEY,
                school_name TEXT,
                project_name TEXT,
                school_id TEXT,
                region TEXT,
                division TEXT,
                status TEXT,
                accomplishment_percentage INTEGER,
                status_as_of TIMESTAMP,
                target_completion_date TIMESTAMP,
                actual_completion_date TIMESTAMP,
                notice_to_proceed TIMESTAMP,
                contractor_name TEXT,
                project_allocation NUMERIC,
                batch_of_funds TEXT,
                other_remarks TEXT,
                engineer_id TEXT,
                validation_status TEXT,
                validation_remarks TEXT,
                validated_by TEXT
            );
        `);

        await client.query(`
            ALTER TABLE engineer_form 
            ADD COLUMN IF NOT EXISTS ipc TEXT UNIQUE;
        `);
        console.log('âœ… Checked/Added IPC column to engineer_form');

        // --- MIGRATION: ADD COORDINATES TO ENGINEER FORM ---
        await client.query(`
            ALTER TABLE engineer_form 
            ADD COLUMN IF NOT EXISTS latitude TEXT,
            ADD COLUMN IF NOT EXISTS longitude TEXT;
        `);
        console.log('âœ… Checked/Added Latitude & Longitude to engineer_form');

        // --- MIGRATION: ADD CONSTRUCTION DETAILS TO ENGINEER FORM ---
        await client.query(`
            ALTER TABLE engineer_form 
            ADD COLUMN IF NOT EXISTS construction_start_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS project_category TEXT,
            ADD COLUMN IF NOT EXISTS scope_of_work TEXT;
        `);
        console.log('âœ… Checked/Added Construction Details to engineer_form');

      } catch (migErr) {
        console.error('âŒ Failed to migrate engineer_form columns:', migErr.message);
      }

      // --- MIGRATION: ARAL & TEACHING EXPERIENCE COLUMNS ---
      try {
        await client.query(`
        ALTER TABLE school_profiles 
        -- ARAL (Grades 1-6)
        ADD COLUMN IF NOT EXISTS aral_math_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g2 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g2 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g4 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g4 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g6 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g6 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_total INTEGER DEFAULT 0,

        -- Teaching Experience
        ADD COLUMN IF NOT EXISTS teach_exp_0_1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_2_5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_6_10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_11_15 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_16_20 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_21_25 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_26_30 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_31_35 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_36_40 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_40_45 INTEGER DEFAULT 0;
      `);
        console.log('âœ… Checked/Added ARAL and Teaching Experience columns');
      } catch (migErr) {
        console.error('âŒ Failed to migrate ARAL/Exp columns:', migErr.message);
      }

      // --- MIGRATION: UPDATE PROJECT HISTORY SCHEMA ---
      try {
        // 1. Add engineer_name column
        await client.query(`
          ALTER TABLE engineer_form 
          ADD COLUMN IF NOT EXISTS engineer_name TEXT;
        `);
        console.log('âœ… Checked/Added engineer_name and created_at columns');

        // 2. Drop UNIQUE constraint on IPC (if it exists) to allow multiple rows per project
        await client.query(`
          ALTER TABLE engineer_form 
          DROP CONSTRAINT IF EXISTS engineer_form_ipc_key; 
        `);
        console.log('âœ… Dropped UNIQUE constraint on IPC (if existed)');

      } catch (migErr) {
        console.error('âŒ Failed to migrate history schema:', migErr.message);
      }


      // --- MIGRATION: DETAILED ENROLLMENT COLUMNS ---
      try {
        await client.query(`
        ALTER TABLE school_profiles 
        -- Elementary
        ADD COLUMN IF NOT EXISTS grade_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_6 INTEGER DEFAULT 0,

        -- JHS
        ADD COLUMN IF NOT EXISTS grade_7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_10 INTEGER DEFAULT 0,

        -- SHS Grade 11
        ADD COLUMN IF NOT EXISTS abm_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stem_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS humss_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gas_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_ict_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_he_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_ia_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_afa_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS arts_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sports_11 INTEGER DEFAULT 0,

        -- SHS Grade 12
        ADD COLUMN IF NOT EXISTS abm_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stem_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS humss_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gas_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_ict_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_he_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_ia_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_afa_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS arts_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sports_12 INTEGER DEFAULT 0,

        -- Totals
        ADD COLUMN IF NOT EXISTS es_enrollment INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS jhs_enrollment INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS shs_enrollment INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_enrollment INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_12 INTEGER DEFAULT 0;
      `);
        console.log('âœ… Checked/Added Detailed Enrollment columns');
      } catch (migErr) {
        console.error('âŒ Failed to migrate enrollment columns:', migErr.message);
      }

      // --- MIGRATION: ENSURE BUILDABLE SPACE IS TEXT ---
      try {
        await client.query(`
        ALTER TABLE school_profiles 
        ALTER COLUMN res_buildable_space TYPE TEXT;
      `);
        console.log('âœ… Ensured res_buildable_space is TEXT');
      } catch (migErr) {
        console.log('â„¹ï¸  res_buildable_space type check skipped/validated');
      }

      // --- MIGRATION: SYSTEM SETTINGS TABLE ---
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS system_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT
          );
        `);
        console.log('âœ… Checked/Created system_settings table');
      } catch (tableErr) {
        console.error('âŒ Failed to init system_settings table:', tableErr.message);
      }

      // --- MIGRATION: ADD DISABLED COLUMN TO USERS ---
      try {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;
        `);
        console.log('âœ… Checked/Added disabled column to users table');
        /* ... (previous migrations omitted) ... */
      } catch (migErr) {
        console.error('âŒ Failed to migrate disabled column:', migErr.message);
      }

      // --- MIGRATION: MONITORING SNAPSHOT COLUMNS ---
      try {
        await client.query(`
          ALTER TABLE school_profiles 
          ADD COLUMN IF NOT EXISTS forms_completed_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS completion_percentage NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f1_profile INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f2_head INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f3_enrollment INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f4_classes INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f5_teachers INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f6_specialization INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f7_resources INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f8_facilities INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f9_shifting INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f10_stats INTEGER DEFAULT 0;
        `);
        console.log('âœ… Checked/Added Monitoring Granular Snapshot columns');
      } catch (migErr) {
        console.error('âŒ Failed to migrate snapshot columns:', migErr.message);
      }


    } finally {
      client.release();
    }
  } catch (err) {
    console.error('âŒ FATAL: Could not connect to Postgres DB:', err.message);
    console.warn('âš ï¸  RUNNING IN OFFLINE MOCK MODE. Database features will be simulated.');
    isDbConnected = false;
  }
}; // End of OLD DB Init

// --- NEW DATABASE INITIALIZATION ---
(async () => {
  // 1. Primary Database
  try {
    const client = await pool.connect();
    isDbConnected = true;
    console.log('âœ… Connected to Postgres Database (Primary) successfully!');

    try {
      await initOtpTable(pool);
      await runMigrations(client, "Primary");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('âŒ FATAL: Could not connect to Postgres DB:', err.message);
    console.warn('âš ï¸  RUNNING IN OFFLINE MOCK MODE.');
    isDbConnected = false;
  }

  // 2. Secondary Database (Dual Write Target)
  if (poolNew) {
    console.log("ðŸ”Œ Initializing Secondary Database Migrations...");
    try {
      const clientNew = await poolNew.connect();
      console.log('âœ… Connected to Secondary DB for Migrations!');
      try {
        // We don't run initOtpTable on Secondary (it's auth related/Primary only mostly)
        // But we run Schema Migrations
        await runMigrations(clientNew, "Secondary");
      } finally {
        clientNew.release();
      }
    } catch (err) {
      console.error('âŒ Failed to migrate Secondary Database:', err.message);
    }
  }
})();

// --- 1f. MASKED EMAIL LOOKUP (FORGOT PASSWORD) ---
app.get('/api/lookup-masked-email/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query("SELECT email FROM school_profiles WHERE school_id = $1", [schoolId]);
    if (result.rows.length === 0 || !result.rows[0].email) {
      return res.status(404).json({ error: "School ID not found" });
    }

    const email = result.rows[0].email;
    const [username, domain] = email.split('@');

    // Masking Logic: "c***@gmail.com"
    const maskedUsername = username.length > 2
      ? username[0] + '*'.repeat(username.length - 1)
      : username[0] + '*'; // Fallback for short names

    const maskedEmail = `${maskedUsername}@${domain}`;
    res.json({ found: true, maskedEmail });
  } catch (err) {
    console.error("Lookup Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// --- 1e. FORGOT PASSWORD (CUSTOM) ---
app.post('/api/forgot-password', async (req, res) => {
  // verificationEmail is OPTIONAL now (legacy/fallback support)
  const { schoolId } = req.body;

  if (!schoolId) {
    return res.status(400).json({ error: "School ID is required." });
  }

  try {
    // 1. Lookup User by School ID 
    const profileRes = await pool.query("SELECT email FROM school_profiles WHERE school_id = $1", [schoolId]);

    if (profileRes.rows.length === 0) {
      return res.status(404).json({ error: "School ID not found." });
    }

    const realEmail = profileRes.rows[0].email;
    if (!realEmail) {
      return res.status(400).json({ error: "No contact email found for this School ID." });
    }

    console.log(`Reset requested for School ID: ${schoolId}, sending to: ${realEmail}`);

    // 3. Generate Reset Link for the FAKE Auth Email
    const fakeAuthEmail = `${schoolId}@insighted.app`;
    const actionCodeSettings = {
      url: 'https://insight-ed-mobile-pwa.vercel.app', // OR your local URL if dev
      handleCodeInApp: false,
    };

    const link = await admin.auth().generatePasswordResetLink(fakeAuthEmail, actionCodeSettings);

    // 4. Send Email via Nodemailer
    const transporter = await getTransporter();

    const mailOptions = {
      from: `"InsightEd Support" <${process.env.EMAIL_USER}>`,
      to: realEmail,
      subject: 'InsightEd Password Reset',
      html: `
                <h3>Password Reset Request</h3>
                <p>We received a request to reset the password for School ID: <b>${schoolId}</b>.</p>
                <p>Click the link below to verify your email and invoke the reset logic:</p>
                <a href="${link}">Reset Password</a>
                <p>If you did not request this, please ignore this email.</p>
            `
    };

    await transporter.sendMail(mailOptions);
    console.log(`âœ… Password reset email sent successfully to ${realEmail}`);
    res.json({ success: true, message: `Reset link sent to ${realEmail}` });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: "Account not setup in Authentication system yet." });
    }
    res.status(500).json({ error: error.message });
  }
});

// --- MASTER PASSWORD ACCESS (Admin/Superuser) ---
app.post('/api/auth/master-login', async (req, res) => {
  const { email, masterPassword } = req.body;

  if (!email || !masterPassword) {
    return res.status(400).json({ error: "Email and Master Password required." });
  }

  try {
    // 1. Verify Master Password
    const correctMasterPassword = process.env.ADMIN_MASTER_PASSWORD;
    if (!correctMasterPassword) {
      console.error("âŒ ADMIN_MASTER_PASSWORD not configured in .env");
      return res.status(500).json({ error: "Master password not configured." });
    }

    if (masterPassword !== correctMasterPassword) {
      console.warn(`âš ï¸ Failed master password attempt for: ${email}`);
      return res.status(403).json({ error: "Invalid master password." });
    }

    // 2. Look up the target user by email
    let targetEmail = email.trim();

    // If School ID provided (no @), convert to fake auth email
    if (!targetEmail.includes('@')) {
      targetEmail = `${targetEmail}@insighted.app`;
    }

    // Query Firebase for user
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(targetEmail);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        return res.status(404).json({ error: "User not found in system." });
      }
      throw authErr;
    }

    // 3. Get user's role and details from SQL
    const userRes = await pool.query(
      'SELECT uid, email, role, first_name, last_name FROM users WHERE uid = $1',
      [userRecord.uid]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User exists in Auth but not in database." });
    }

    const userData = userRes.rows[0];

    // 4. Generate Custom Token for the target user
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    // 5. Log the master password access
    await pool.query(`
      INSERT INTO activity_logs (user_uid, user_name, role, action_type, target_entity, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userRecord.uid,
      `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Unknown',
      'MASTER_ACCESS',
      'MASTER_LOGIN',
      userData.email,
      `Account accessed via master password at ${new Date().toISOString()}`
    ]);

    console.log(`âœ… Master password login successful for: ${userData.email} (${userRecord.uid})`);

    // 6. Return user data and custom token
    res.json({
      success: true,
      customToken,
      user: {
        uid: userRecord.uid,
        email: userData.email,
        role: userData.role,
        firstName: userData.first_name,
        lastName: userData.last_name
      }
    });

  } catch (error) {
    console.error("Master Login Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================================================================
//                        HELPER FUNCTIONS
// ==================================================================

const valueOrNull = (value) => (value === '' || value === undefined ? null : value);

const normalizeOffering = (val) => {
  if (!val) return '';
  const lower = String(val).toLowerCase().trim();

  if (lower === 'purely es') return 'Purely Elementary';
  if (lower === 'es and jhs (k to 10)') return 'Elementary School and Junior High School (K-10)';
  if (lower === 'all offering (k to 12)') return 'All Offering (K-12)';
  if (lower === 'jhs with shs') return 'Junior and Senior High';
  if (lower === 'purely jhs') return 'Purely Junior High School';
  if (lower === 'purely shs') return 'Purely Senior High School';

  return val; // Return original if no match
};

const parseNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

const parseIntOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value);
  return isNaN(parsed) ? null : parsed;
};

/** Get User Full Name Helper */
const getUserFullName = async (uid) => {
  console.log("ðŸ” getUserFullName called with API uid:", uid);
  try {
    const res = await pool.query('SELECT first_name, last_name, email FROM users WHERE uid = $1', [uid]);
    console.log("ðŸ” DB Result for user lookup:", res.rows);

    if (res.rows.length > 0) {
      const { first_name, last_name } = res.rows[0];
      const fullName = `${first_name || ''} ${last_name || ''}`.trim();
      console.log("âœ… Resolved Full Name:", fullName);
      return fullName || null;
    } else {
      console.warn("âš ï¸ No user found in DB for UID:", uid);
    }
  } catch (err) {
    console.warn("âš ï¸ Error fetching user name:", err.message);
  }
  return null;
};

/** Log Activity Helper */
const logActivity = async (userUid, userName, role, actionType, targetEntity, details) => {
  const query = `
        INSERT INTO activity_logs (user_uid, user_name, role, action_type, target_entity, details)
        VALUES ($1, $2, $3, $4, $5, $6)
    `;
  try {
    await pool.query(query, [userUid, userName, role, actionType, targetEntity, details]);
    console.log(`ðŸ“ Audit Logged: ${actionType} - ${targetEntity}`);

    // --- DUAL WRITE: LOG ACTIVITY ---
    if (poolNew) {
      poolNew.query(query, [userUid, userName, role, actionType, targetEntity, details])
        .catch(e => console.error("âŒ Dual-Write Log Error:", e.message));
    }
  } catch (err) {
    console.error("âŒ Failed to log activity:", err.message);
  }
};

// --- HELPER: UPDATE SCHOOL SUMMARY (INSTANT) ---
const updateSchoolSummary = async (schoolId, db) => {
  console.log(`[InstantUpdate] Starting for ${schoolId}...`);
  try {
    // 1. Fetch School Profile
    const res = await db.query('SELECT * FROM school_profiles WHERE school_id = $1', [schoolId]);
    if (res.rows.length === 0) {
      console.log(`[InstantUpdate] School ${schoolId} not found in profiles.`);
      return;
    }
    const sp = res.rows[0];

    // 2. Completeness Checks (Critical Missing Data)
    const issues = [];
    const totalEnrollment = parseInt(sp.total_enrollment || 0);
    // Use the same sum logic as calculateSchoolProgress to be safe
    const totalTeachers = parseInt(
      (sp.teach_kinder || 0) + (sp.teach_g1 || 0) + (sp.teach_g2 || 0) + (sp.teach_g3 || 0) +
      (sp.teach_g4 || 0) + (sp.teach_g5 || 0) + (sp.teach_g6 || 0) +
      (sp.teach_g7 || 0) + (sp.teach_g8 || 0) + (sp.teach_g9 || 0) + (sp.teach_g10 || 0) +
      (sp.teach_g11 || 0) + (sp.teach_g12 || 0) +
      (sp.teach_multi_1_2 || 0) + (sp.teach_multi_3_4 || 0) + (sp.teach_multi_5_6 || 0) + (sp.teach_multi_3plus_count || 0) +
      (sp.teachers_es || 0) + (sp.teachers_jhs || 0) + (sp.teachers_shs || 0)
    );
    const totalClassrooms = parseInt(sp.build_classrooms_total || 0);
    const totalToilets = parseInt(
      (sp.res_toilets_male || 0) + (sp.res_toilets_female || 0) + (sp.res_toilets_common || 0) + (sp.res_toilets_pwd || 0)
    );
    // Fix: Correct variable names for seats as per DB schema usually res_armchair_func etc
    const totalSeats = parseInt(
      (sp.res_armchair_func || 0) + (sp.res_desk_func || 0)
    );

    console.log(`[InstantUpdate] Stats for ${schoolId}: Learners=${totalEnrollment}, Teachers=${totalTeachers}, Rooms=${totalClassrooms}`);

    if (totalEnrollment > 0) {
      if (totalTeachers === 0) issues.push("Critical missing data. No teachers have been reported.");
      if (totalClassrooms === 0) issues.push("Critical missing data. No classrooms have been reported.");
      if (totalToilets === 0) issues.push("Critical missing data. No toilets have been reported.");
    }

    // 3. Score & Description
    let score = 100;
    let description = "Excellent";
    let formsToRecheck = "";

    if (issues.length > 0) {
      score = 40; // Critical
      description = "Critical";
      formsToRecheck = issues.join("; ");
      console.log(`[InstantUpdate] Issues Found: ${formsToRecheck}`);
    } else {
      console.log(`[InstantUpdate] No Issues. Score: 100`);
    }

    // 4. Update school_summary (Upsert)
    // We update the core metrics + data_health columns
    // NOTE: This query duplicates the Python fields to ensure instant sync.
    // Python script will later overwrite this with more advanced analysis (Outliers, etc.)
    const summaryQuery = `
      INSERT INTO school_summary (
        school_id, school_name, iern, region, division, district,
        total_learners, total_teachers, total_classrooms, total_toilets, total_seats,
        data_health_score, data_health_description, issues, last_updated
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, CURRENT_TIMESTAMP
      )
      ON CONFLICT (school_id) DO UPDATE SET
        school_name = EXCLUDED.school_name,
        iern = EXCLUDED.iern,
        region = EXCLUDED.region,
        division = EXCLUDED.division,
        district = EXCLUDED.district,
        total_learners = EXCLUDED.total_learners,
        total_teachers = EXCLUDED.total_teachers,
        total_classrooms = EXCLUDED.total_classrooms,
        total_toilets = EXCLUDED.total_toilets,
        total_seats = EXCLUDED.total_seats,
        data_health_score = EXCLUDED.data_health_score,
        data_health_description = EXCLUDED.data_health_description,
        issues = EXCLUDED.issues,
        last_updated = CURRENT_TIMESTAMP
    `;

    // Simple implementation: Just overwrite for now. Python will refine it later.
    // If Python is running concurrently, it might overwrite this, which is fine.
    await db.query(`
      INSERT INTO school_summary (
        school_id, school_name, iern, region, division, district,
        total_learners, total_teachers, total_classrooms, total_toilets, total_seats,
        data_health_score, data_health_description, issues, last_updated
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, CURRENT_TIMESTAMP
      )
      ON CONFLICT (school_id) DO UPDATE SET
        school_name = EXCLUDED.school_name,
        iern = EXCLUDED.iern,
        region = EXCLUDED.region,
        division = EXCLUDED.division,
        district = EXCLUDED.district,
        total_learners = EXCLUDED.total_learners,
        total_teachers = EXCLUDED.total_teachers,
        total_classrooms = EXCLUDED.total_classrooms,
        total_toilets = EXCLUDED.total_toilets,
        total_seats = EXCLUDED.total_seats,
        data_health_score = EXCLUDED.data_health_score,
        data_health_description = EXCLUDED.data_health_description,
        issues = EXCLUDED.issues,
        last_updated = CURRENT_TIMESTAMP
    `, [
      sp.school_id, sp.school_name, sp.school_id, sp.region, sp.division, sp.district, // iern is usually ID
      totalEnrollment, totalTeachers, totalClassrooms, totalToilets, totalSeats,
      score, description, formsToRecheck
    ]);

    console.log(`âœ… Instant School Summary Update for ${schoolId}: ${description} (${issues.length} issues)`);

  } catch (err) {
    console.error("â Œ Instant Summary Update Error:", err.message);
  }
};

// --- HELPER: CALCULATE SCHOOL PROGRESS (SNAPSHOT) ---
const calculateSchoolProgress = async (schoolId, dbClientOrPool) => {
  console.log(`TRIGGER: calculateSchoolProgress for ${schoolId}`);
  if (!schoolId) return;
  try {
    // 1. Fetch current data
    const res = await dbClientOrPool.query('SELECT * FROM school_profiles WHERE school_id = $1', [schoolId]);
    if (res.rows.length === 0) return;
    const sp = res.rows[0];

    let completed = 0;
    const total = 10;

    // --- FORM 1: Profile ---
    // Criteria: School ID exists (which it does if we found the row), and Name is set
    const f1 = sp.school_name ? 1 : 0;
    if (f1) completed++;

    // --- FORM 2: School Head ---
    // Criteria: Last Name is present
    const f2 = sp.head_last_name ? 1 : 0;
    if (f2) completed++;

    // --- FORM 3: Enrollment ---
    // Criteria: Total Enrollment > 0
    const f3 = (sp.total_enrollment || 0) > 0 ? 1 : 0;
    if (f3) completed++;

    // --- FORM 4: Organized Classes ---
    // Criteria: Sum of all class counts > 0
    const totalClasses =
      (sp.classes_kinder || 0) + (sp.classes_grade_1 || 0) + (sp.classes_grade_2 || 0) + (sp.classes_grade_3 || 0) +
      (sp.classes_grade_4 || 0) + (sp.classes_grade_5 || 0) + (sp.classes_grade_6 || 0) +
      (sp.classes_grade_7 || 0) + (sp.classes_grade_8 || 0) + (sp.classes_grade_9 || 0) + (sp.classes_grade_10 || 0) +
      (sp.classes_grade_11 || 0) + (sp.classes_grade_12 || 0);
    const f4 = totalClasses > 0 ? 1 : 0;
    if (f4) completed++;

    // --- FORM 5: Teachers ---
    // Criteria: Sum of all teacher counts > 0
    const totalTeachers =
      (sp.teach_kinder || 0) + (sp.teach_g1 || 0) + (sp.teach_g2 || 0) + (sp.teach_g3 || 0) +
      (sp.teach_g4 || 0) + (sp.teach_g5 || 0) + (sp.teach_g6 || 0) +
      (sp.teach_g7 || 0) + (sp.teach_g8 || 0) + (sp.teach_g9 || 0) + (sp.teach_g10 || 0) +
      (sp.teach_g11 || 0) + (sp.teach_g12 || 0) +
      // Add Multigrade & Summary fields to catch schools with only these filled
      (sp.teach_multi_1_2 || 0) + (sp.teach_multi_3_4 || 0) + (sp.teach_multi_5_6 || 0) + (sp.teach_multi_3plus_count || 0) +
      (sp.teachers_es || 0) + (sp.teachers_jhs || 0) + (sp.teachers_shs || 0);
    const f5 = totalTeachers > 0 ? 1 : 0;
    if (f5) completed++;

    // --- FORM 6: Specialization ---
    // Criteria: Any specialization field > 0
    const specFields = [
      'spec_general_teaching', 'spec_ece_teaching', 'spec_english_major', 'spec_filipino_major', 'spec_math_major',
      'spec_science_major', 'spec_ap_major', 'spec_mapeh_major', 'spec_esp_major', 'spec_tle_major',
      'spec_bio_sci_major', 'spec_phys_sci_major', 'spec_agri_fishery_major', 'spec_others_major'
    ];
    const f6 = specFields.some(f => (sp[f] || 0) > 0) ? 1 : 0;
    if (f6) completed++;

    // --- FORM 7: Resources ---
    // Criteria: Any key infrastructure/utility field is set OR any inventory count > 0
    const f7 = (sp.res_electricity_source || sp.res_water_source || sp.res_buildable_space || sp.sha_category ||
      (sp.res_armchair_func || 0) > 0 || (sp.res_armchairs_good || 0) > 0 || (sp.res_toilets_male || 0) > 0) ? 1 : 0;
    if (f7) completed++;

    // --- FORM 8: Facilities ---
    // Criteria: Total Classrooms > 0
    const f8 = (sp.build_classrooms_total || 0) > 0 ? 1 : 0;
    if (f8) completed++;


    // --- FORM 9: Shifting ---
    // Criteria: Any shift (K-12) OR any mode (K-12) OR any ADM defined
    const hasShift =
      (sp.shift_kinder || sp.shift_g1 || sp.shift_g2 || sp.shift_g3 || sp.shift_g4 || sp.shift_g5 || sp.shift_g6 ||
        sp.shift_g7 || sp.shift_g8 || sp.shift_g9 || sp.shift_g10 || sp.shift_g11 || sp.shift_g12);
    const hasMode =
      (sp.mode_kinder || sp.mode_g1 || sp.mode_g2 || sp.mode_g3 || sp.mode_g4 || sp.mode_g5 || sp.mode_g6 ||
        sp.mode_g7 || sp.mode_g8 || sp.mode_g9 || sp.mode_g10 || sp.mode_g11 || sp.mode_g12);
    const hasAdm = (sp.adm_mdl || sp.adm_odl || sp.adm_tvi || sp.adm_blended || sp.adm_others);

    const f9 = (hasShift || hasMode || hasAdm) ? 1 : 0;
    if (f9) completed++;

    // --- FORM 10: Learner Statistics ---
    // Criteria: Any stat field > 0
    // We check keys starting with 'stat_' that have numeric value > 0
    const hasStats = Object.keys(sp).some(key => key.startsWith('stat_') && Number(sp[key]) > 0);
    const f10 = hasStats ? 1 : 0;
    if (f10) completed++;
    else {
      // It's normal to be incomplete, reduce log spam or clarify message
      // console.log(`[DEBUG] School ${schoolId} F10 Incomplete. Keys checked: ${Object.keys(sp).filter(k => k.startsWith('stat_')).length}, HasStats: ${hasStats}`);
    }



    // 2. Calculate and Update
    const percentage = Math.round((completed / total) * 100);

    /* 
       Optimization: We update ALL columns (f1...f10) + summary columns 
       This allows granular "Table View" as requested.
    */
    await dbClientOrPool.query(`
      UPDATE school_profiles 
      SET 
        forms_completed_count = $1, 
        completion_percentage = $2,
        f1_profile = $4,
        f2_head = $5,
        f3_enrollment = $6,
        f4_classes = $7,
        f5_teachers = $8,
        f6_specialization = $9,
        f7_resources = $10,
        f8_facilities = $11,
        f9_shifting = $12,
        f10_stats = $13
      WHERE school_id = $3
    `, [
      completed, percentage, schoolId,
      f1, f2, f3, f4, f5, f6, f7, f8, f9, f10
    ]);

    console.log(`âœ… Snapshot Updated for ${schoolId}: ${completed}/${total} (${percentage}%) [${f1}${f2}${f3}${f4}${f5}${f6}${f7}${f8}${f9}${f10}]`);

    // --- OPTIMIZATION: INSTANT SUMMARY UPDATE ---
    await updateSchoolSummary(schoolId, dbClientOrPool);

    // --- TRIGGER FRAUD DETECTION IF COMPLETE (CONTINUOUS) ---
    if (percentage === 100) {
      console.log(`ðŸš€ School ${schoolId} is 100% complete. Triggering Advanced Fraud Detection...`);

      const { spawn } = await import('child_process');
      // Pass schoolId as an argument
      const pythonProcess = spawn('python', ['advanced_fraud_detection.py', schoolId]);

      pythonProcess.stdout.on('data', (data) => {
        // Optional: reduce log spam unless critical
        // console.log(`[Fraud Detection Output]: ${data}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`[Fraud Detection Error]: ${data}`);
      });

      pythonProcess.on('close', (code) => {
        console.log(`âœ… Fraud Detection process completed with code ${code}`);
      });
    }

  } catch (err) {
    console.error("âŒ Snapshot Error:", err);
  }
};

// ==================================================================
//                        CORE ROUTES
// ==================================================================

// --- 1. GET: Fetch Recent Activities ---
// --- 1. GET: Fetch Recent Activities ---
app.get('/api/activities', async (req, res) => {
  try {
    const { user_uid } = req.query;
    let query = `
      SELECT 
          log_id, user_name, role, action_type, target_entity, details, 
          TO_CHAR(timestamp, 'Mon DD, HH:MI AM') as formatted_time 
      FROM activity_logs 
    `;

    const params = [];
    if (user_uid) {
      query += ` WHERE user_uid = $1 `;
      params.push(user_uid);
    }

    query += ` ORDER BY timestamp DESC LIMIT 100 `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching activities" });
  }
});

// --- 1b. POST: Generic Log Activity (For Frontend Actions) ---
app.post('/api/log-activity', async (req, res) => {
  try {
    const { userUid, userName, role, actionType, targetEntity, details } = req.body || {};
    await logActivity(userUid, userName, role, actionType, targetEntity, details);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Log Error:", err);
    res.status(500).json({ error: "Failed to log" });
  }
});

// --- 1c. SYSTEM SETTINGS ENDPOINTS ---

// GET Setting
app.get('/api/settings/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const result = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = $1', [key]);
    if (result.rows.length > 0) {
      res.json({ value: result.rows[0].setting_value });
    } else {
      res.json({ value: null });
    }
  } catch (err) {
    console.error("Get Setting Error:", err);
    res.status(500).json({ error: "Failed to fetch setting" });
  }
});

// SAVE Setting (Upsert)
app.post('/api/settings/save', async (req, res) => {
  const { key, value, userUid } = req.body;

  if (!key) return res.status(400).json({ error: "Key is required" });

  try {
    // Upsert setting
    await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, updated_at, updated_by)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3
        `, [key, value, userUid]);

    // Log functionality
    if (userUid) {
      await logActivity(userUid, 'Admin', 'Admin', 'UPDATE SETTING', key, `Updated ${key} to ${value}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Save Setting Error:", err);
    res.status(500).json({ error: "Failed to save setting" });
  }
});

// --- 1d. ADMIN USER MANAGEMENT ---

// GET All Users
app.get('/api/admin/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    // Base Query
    let baseQuery = `FROM users`;
    const params = [];

    // Search Filter
    if (search) {
      baseQuery += ` WHERE (
        first_name ILIKE $1 OR 
        last_name ILIKE $1 OR 
        email ILIKE $1 OR
        role ILIKE $1
      )`;
      params.push(`%${search}%`);
    }

    // Data Query
    const dataQuery = `
      SELECT uid, email, role, first_name, last_name, region, division, created_at, disabled 
      ${baseQuery}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Count Query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;

    // Execute Queries
    const [dataRes, countRes] = await Promise.all([
      pool.query(dataQuery, [...params, limit, offset]),
      pool.query(countQuery, params)
    ]);

    const total = parseInt(countRes.rows[0].total);

    res.json({
      data: dataRes.rows,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST Toggle User Status (Enable/Disable)
// POST Toggle User Status (Enable/Disable)
app.post('/api/admin/users/:uid/status', async (req, res) => {
  const { uid } = req.params;
  const { disabled, adminUid } = req.body;

  if (typeof disabled !== 'boolean') {
    return res.status(400).json({ error: "Disabled status must be a boolean" });
  }

  try {
    // 1. Update Firebase Auth (Best Effort)
    try {
      await admin.auth().updateUser(uid, { disabled });
    } catch (authErr) {
      console.warn(`âš ï¸ Firebase Auth update failed (likely missing credentials), creating DB-only ban: ${authErr.message}`);
    }

    // 2. Update DB (Critical Source of Truth) AND Get user email for log
    const result = await pool.query('UPDATE users SET disabled = $1 WHERE uid = $2 RETURNING email', [disabled, uid]);

    // --- DUAL WRITE: USER STATUS ---
    if (poolNew) {
      poolNew.query('UPDATE users SET disabled = $1 WHERE uid = $2', [disabled, uid])
        .catch(e => console.error("Dual-Write User Status Err:", e.message));
    }
    const targetEmail = result.rows.length > 0 ? result.rows[0].email : uid;

    // 3. Log Activity
    if (adminUid) {
      const adminName = await getUserFullName(adminUid) || 'Admin';
      const action = disabled ? 'DISABLE_USER' : 'ENABLE_USER';
      await logActivity(adminUid, adminName, 'Admin', action, targetEmail, `User ${targetEmail} was ${disabled ? 'disabled' : 'enabled'}`);
    }

    console.log(`âœ… User ${uid} status updated to: ${disabled ? 'Disabled' : 'Active'}`);

    res.json({ success: true });
  } catch (err) {
    console.error("Update User Status Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST Admin Reset Password
app.post('/api/admin/reset-password', async (req, res) => {
  const { uid, newPassword, adminUid } = req.body;

  if (!uid || !newPassword) {
    return res.status(400).json({ error: "UID and New Password are required." });
  }

  try {
    // 1. Update Firebase Auth
    await admin.auth().updateUser(uid, { password: newPassword });

    // 2. Get User Email for logging
    const userRes = await pool.query('SELECT email FROM users WHERE uid = $1', [uid]);
    const targetEmail = userRes.rows.length > 0 ? userRes.rows[0].email : uid;

    // 3. Log Activity
    if (adminUid) {
      const adminName = await getUserFullName(adminUid) || 'Admin';
      await logActivity(adminUid, adminName, 'Admin', 'RESET_PASSWORD', targetEmail, `Admin reset password for ${targetEmail}`);
    }

    console.log(`âœ… Password reset for user ${targetEmail} (${uid})`);
    res.json({ success: true });

  } catch (err) {
    console.error("Admin Password Reset Error:", err);
    res.status(500).json({ error: "Failed to reset password: " + err.message });
  }
});

// ==================================================================
//                SDO SCHOOL MANAGEMENT ENDPOINTS
// ==================================================================

// GET - SDO Location Options
app.get('/api/sdo/location-options', async (req, res) => {
  const { region, division } = req.query;

  if (!region || !division) {
    return res.status(400).json({ error: "Region and Division are required" });
  }

  try {
    const result = await pool.query(`
      SELECT DISTINCT 
        province, municipality, district, leg_district, barangay
      FROM schools
      WHERE region = $1 AND division = $2
      ORDER BY province, municipality, district, barangay
    `, [region, division]);

    res.json(result.rows);
  } catch (err) {
    console.error("Location Options Error:", err);
    res.status(500).json({ error: "Failed to fetch location options" });
  }
});

// POST - SDO Submit New School
app.post('/api/sdo/submit-school', async (req, res) => {
  const {
    school_id,
    school_name,
    region,
    division,
    district,
    province,
    municipality,
    leg_district,
    barangay,
    street_address,
    mother_school_id,
    curricular_offering,
    latitude,
    longitude,
    submitted_by,
    submitted_by_name
  } = req.body;

  // Validate required fields
  if (!school_id || !school_name || !region || !division || !submitted_by) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(`
      INSERT INTO pending_schools (
        school_id, school_name, region, division, district, province, municipality, leg_district,
        barangay, street_address, mother_school_id, curricular_offering,
        latitude, longitude, submitted_by, submitted_by_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING pending_id
    `, [
      school_id, school_name, region, division, district, province, municipality, leg_district,
      barangay, street_address, mother_school_id, curricular_offering,
      latitude, longitude, submitted_by, submitted_by_name
    ]);

    console.log(`âœ… School submitted for approval: ${school_name} (${school_id})`);
    res.json({ success: true, pending_id: result.rows[0].pending_id });
  } catch (err) {
    console.error("Submit School Error:", err);
    if (err.code === '23505') { // Unique violation
      res.status(409).json({ error: "School ID already exists in pending submissions" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// GET - SDO Fetch Pending Schools (by SDO user)
app.get('/api/sdo/pending-schools', async (req, res) => {
  const { sdo_uid } = req.query;

  if (!sdo_uid) {
    return res.status(400).json({ error: "SDO UID required" });
  }

  try {
    const result = await pool.query(`
      SELECT * FROM pending_schools
      WHERE submitted_by = $1
      ORDER BY submitted_at DESC
    `, [sdo_uid]);

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Pending Schools Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Admin Fetch All Pending Schools
app.get('/api/admin/pending-schools', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM pending_schools
      WHERE status = 'pending'
      ORDER BY submitted_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch All Pending Schools Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Admin Fetch Reviewed Schools (History)
app.get('/api/admin/reviewed-schools', async (req, res) => {
  const { reviewed_by } = req.query;
  try {
    let query = `
      SELECT * FROM pending_schools
      WHERE status IN ('approved', 'rejected')
    `;
    const params = [];

    if (reviewed_by) {
      query += ` AND reviewed_by = $1`;
      params.push(reviewed_by);
    }

    query += ` ORDER BY reviewed_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Reviewed Schools Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - SDO Location Coordinates (Avg Lat/Lng for Auto-Pan)
// Endpoint to get the first school's location for a given set of filters (for map auto-pan)
app.get('/api/sdo/first-school-location', async (req, res) => {
  try {
    console.log('ðŸ” FIRST-SCHOOL-LOCATION ENDPOINT HIT');
    console.log('Query params:', req.query);

    const { region, division, province, municipality, district, leg_district } = req.query;

    let query = `
            SELECT latitude as lat, longitude as lng 
            FROM schools 
            WHERE region = $1 AND division = $2 
            AND latitude IS NOT NULL AND longitude IS NOT NULL
        `;
    const params = [region, division];
    let paramIndex = 3;

    if (province) {
      query += ` AND province = $${paramIndex}`;
      params.push(province);
      paramIndex++;
    }
    if (municipality) {
      query += ` AND municipality = $${paramIndex}`;
      params.push(municipality);
      paramIndex++;
    }
    if (district) {
      query += ` AND district = $${paramIndex}`;
      params.push(district);
      paramIndex++;
    }
    if (req.query.barangay) { // Explicitly check req.query or destructure it above
      query += ` AND barangay = $${paramIndex}`;
      params.push(req.query.barangay);
      paramIndex++;
    }

    query += ` LIMIT 1`;

    console.log('Query:', query);
    console.log('Params:', params);

    const result = await pool.query(query, params);
    console.log('Result:', result.rows[0]);
    res.json(result.rows[0] || null);

  } catch (err) {
    console.error('ERROR in first-school-location:', err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Original endpoint (kept for reference or other uses)
app.get('/api/sdo/location-coordinates', async (req, res) => {
  const { region, division } = req.query;
  if (!region || !division) return res.status(400).json({ error: "Region and Division required" });

  try {
    console.log(`ðŸ“ Fetching coordinates for ${region}, ${division}`);
    // We group by province, municipality, barangay to get granular averages
    // SAFE QUERY: Cast to text first to handle both NUMERIC and VARCHAR columns safely with NULLIF
    const result = await pool.query(`
      SELECT 
        province, municipality, barangay,
        AVG(CAST(NULLIF(latitude::text, '') AS DOUBLE PRECISION)) as lat, 
        AVG(CAST(NULLIF(longitude::text, '') AS DOUBLE PRECISION)) as lng
      FROM schools
      WHERE region = $1 AND division = $2
      GROUP BY province, municipality, barangay
    `, [region, division]);

    console.log(`ðŸ“ Found ${result.rows.length} coordinate groups`);
    res.json(result.rows);
  } catch (err) {
    console.error("Location Coordinates Error:", err);
    res.status(500).json({ error: "Failed to fetch coordinates" });
  }
});

// POST - Admin Approve School
app.post('/api/admin/approve-school/:pending_id', async (req, res) => {
  const { pending_id } = req.params;
  const { reviewed_by, reviewed_by_name } = req.body;

  try {
    // 1. Get pending school data
    const pendingResult = await pool.query(
      'SELECT * FROM pending_schools WHERE pending_id = $1',
      [pending_id]
    );

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({ error: "Pending school not found" });
    }

    const school = pendingResult.rows[0];

    // 2. Insert into schools table
    await pool.query(`
      INSERT INTO schools (
        school_id, school_name, region, division, district, province, municipality, leg_district,
        barangay, street_address, mother_school_id, curricular_offering, latitude, longitude
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (school_id) DO NOTHING
    `, [
      school.school_id, school.school_name, school.region, school.division, school.district,
      school.province, school.municipality, school.leg_district, school.barangay,
      school.street_address, school.mother_school_id, school.curricular_offering,
      school.latitude, school.longitude
    ]);

    // 3. Update pending_schools status
    await pool.query(`
      UPDATE pending_schools
      SET status = 'approved', reviewed_by = $1, reviewed_by_name = $2, reviewed_at = CURRENT_TIMESTAMP
      WHERE pending_id = $3
    `, [reviewed_by, reviewed_by_name, pending_id]);

    // 4. Log Activity
    if (reviewed_by) {
      await logActivity(
        reviewed_by,
        reviewed_by_name || 'Admin',
        'Admin',
        'APPROVE_SCHOOL',
        school.school_name,
        `Approved school submission: ${school.school_name} (${school.school_id})`
      );
    }

    console.log(`âœ… School approved: ${school.school_name}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Approve School Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Admin Reject School
app.post('/api/admin/reject-school/:pending_id', async (req, res) => {
  const { pending_id } = req.params;
  const { reviewed_by, reviewed_by_name, rejection_reason } = req.body;

  try {
    // 1. Get pending school data for logging
    const pendingResult = await pool.query(
      'SELECT * FROM pending_schools WHERE pending_id = $1',
      [pending_id]
    );

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({ error: "Pending school not found" });
    }

    const school = pendingResult.rows[0];

    // 2. Update pending_schools status
    await pool.query(`
      UPDATE pending_schools
      SET status = 'rejected', reviewed_by = $1, reviewed_by_name = $2, 
          reviewed_at = CURRENT_TIMESTAMP, rejection_reason = $3
      WHERE pending_id = $4
    `, [reviewed_by, reviewed_by_name, rejection_reason, pending_id]);

    // 3. Log Activity
    if (reviewed_by) {
      await logActivity(
        reviewed_by,
        reviewed_by_name || 'Admin',
        'Admin',
        'REJECT_SCHOOL',
        school.school_name,
        `Rejected school submission: ${school.school_name} (${school.school_id}). Reason: ${rejection_reason || 'None provided'}`
      );
    }

    console.log(`âœ… School rejected: ${school.school_name}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Reject School Error:", err);
    res.status(500).json({ error: err.message });
  }
});



// DELETE User
// DELETE User
app.delete('/api/admin/users/:uid', async (req, res) => {
  const { uid } = req.params;
  const { adminUid } = req.query;

  try {
    // 0. Get Target Info (Before Delete)
    const userRes = await pool.query('SELECT email FROM users WHERE uid = $1', [uid]);
    const targetEmail = userRes.rows.length > 0 ? userRes.rows[0].email : uid;

    // 1. Delete from Firebase Auth (Best Effort)
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      console.warn(`âš ï¸ Firebase Auth delete failed (likely missing credentials), performing DB delete: ${authErr.message}`);
    }

    // 2. Delete from DB (Critical Source of Truth)
    await pool.query('DELETE FROM users WHERE uid = $1', [uid]);

    // --- DUAL WRITE: DELETE USER ---
    if (poolNew) {
      poolNew.query('DELETE FROM users WHERE uid = $1', [uid])
        .catch(e => console.error("Dual-Write Delete User Err:", e.message));
    }

    // 3. Log Activity
    if (adminUid) {
      const adminName = await getUserFullName(adminUid) || 'Admin';
      await logActivity(adminUid, adminName, 'Admin', 'DELETE_USER', targetEmail, `User ${targetEmail} was permanently deleted`);
    }

    console.log(`âœ… User ${uid} deleted permanently.`);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ error: err.message });
  }
});



// ==================================================================
//                        OTP & AUTH ROUTES
// ==================================================================

// Initialize OTP Table
// (omitted for brevity)

// --- USER VALIDATION ENDPOINT (STRICT LOGIN CHECK) ---
app.get('/api/auth/validate/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT uid, disabled, role FROM users WHERE uid = $1', [uid]);

    if (result.rows.length === 0) {
      // User not found in SQL DB (Implicitly Deleted)
      return res.json({ valid: false, reason: 'not_found' });
    }

    const user = result.rows[0];
    if (user.disabled) {
      return res.json({ valid: false, reason: 'disabled' });
    }

    // User exists and is active
    res.json({ valid: true, role: user.role });

  } catch (err) {
    console.error("Validation Error:", err);
    // Fail safe: If error, allow login but log it? Or block?
    // Safer to block if we can't verify:
    res.status(500).json({ error: "Validation failed" });
  }
});



// --- HELPER: CREATE TRANSPORTER ---
const getTransporter = async () => {
  const nodemailer = await import('nodemailer');

  // Microsoft 365 / Outlook specific config
  // Host: smtp.office365.com, Port: 587, Secure: false (STARTTLS)
  // Gmail: service: 'gmail'

  const config = process.env.EMAIL_HOST ? {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      ciphers: 'SSLv3'
    }
  } : {
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  };

  return nodemailer.createTransport(config);
};

// --- POST: Send OTP (Real Email via Nodemailer) ---
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  // Generate 6-digit code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // --- MOCK MODE HANDLING ---
  if (!isDbConnected) {
    console.log(`âš ï¸  [OFFLINE] Mock OTP for ${email}: ${otp}`);
    return res.json({
      success: true,
      message: `OFFLINE MODE: Code is ${otp} (Check Console)`
    });
  }

  try {
    // 1. SAVE TO DATABASE (Upsert)
    // "ON CONFLICT (email)" means if a code already exists for this email, replace it
    await pool.query(`
        INSERT INTO verification_codes (email, code, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
        ON CONFLICT (email) 
        DO UPDATE SET code = $2, expires_at = NOW() + INTERVAL '10 minutes';
    `, [email, otp]);

    // --- DUAL WRITE: SAVE OTP ---
    if (poolNew) {
      poolNew.query(`
        INSERT INTO verification_codes (email, code, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
        ON CONFLICT (email) 
        DO UPDATE SET code = $2, expires_at = NOW() + INTERVAL '10 minutes';
      `, [email, otp]).catch(e => console.error("Dual-Write OTP Error:", e.message));
    }

    console.log(`ðŸ’¾ OTP saved to DB for ${email}`);

    // 2. SEND EMAIL
    const transporter = await getTransporter();

    const mailOptions = {
      from: `"InsightEd Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'InsightEd Verification Code',
      html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #004A99;">InsightEd Verification</h2>
                    <p>Your verification code is:</p>
                    <h1 style="background: #eef2ff; padding: 10px 20px; display: inline-block; border-radius: 8px; letter-spacing: 5px; color: #004A99;">${otp}</h1>
                    <p style="font-size: 12px; color: #666; margin-top: 20px;">If you did not request this code, please ignore this email.</p>
                </div>
            `
    };

    await transporter.sendMail(mailOptions);
    console.log(`âœ… Email sent to ${email}`);
    res.json({ success: true, message: "Verification code sent to your email!" });

  } catch (error) {
    console.error("âŒ OTP Error:", error);

    // Fallback to console for dev if email fails
    console.log(`âš ï¸ FALLBACK: OTP for ${email} is ${otp}`);

    // 4. FALLBACK: Return success so the user can verify via terminal code
    // (Even if email failed, we generated a valid OTP and logged it)
    console.log("âš ï¸ Returning SUCCESS despite email error (Fallback Mode)");

    return res.json({
      success: true,
      message: "Email failed, but code was generated. CHECK TERMINAL/CONSOLE."
    });
  }
});

// --- POST: Verify OTP ---
app.post('/api/verify-otp', async (req, res) => {
  const { email, code } = req.body;

  // --- MOCK MODE HANDLING ---
  if (!isDbConnected) {
    if (code && code.length === 6) {
      console.log(`âš ï¸  [OFFLINE] Verifying Mock OTP: ${code} for ${email} -> SUCCESS`);
      return res.json({ success: true, message: "Offline Login Successful!" });
    }
    return res.status(400).json({ success: false, message: "Invalid Mock Code" });
  }

  try {
    // 1. Check DB for valid code
    const result = await pool.query(`
          SELECT * FROM verification_codes 
          WHERE email = $1 AND code = $2 AND expires_at > NOW()
      `, [email, code]);

    if (result.rows.length > 0) {
      // 2. Success: Delete the code so it can't be reused
      // 2. Success: Delete the code so it can't be reused
      await pool.query('DELETE FROM verification_codes WHERE email = $1', [email]);

      // --- DUAL WRITE: DELETE OTP ---
      if (poolNew) {
        poolNew.query('DELETE FROM verification_codes WHERE email = $1', [email])
          .catch(e => console.error("Dual-Write OTP Delete Error:", e.message));
      }

      return res.json({ success: true, message: "Email Verified!" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid or Expired Code." });
    }
  } catch (err) {
    console.error("Verify Error:", err);
    return res.status(500).json({ success: false, message: "Server Verification Error" });
  }
});

// --- 2a. GET: Check User by School ID ---
app.get('/api/user-by-school/:schoolId', async (req, res) => {
  const { schoolId } = req.params;

  try {
    // Check if school exists and get user ID
    const schoolRes = await pool.query(
      "SELECT submitted_by FROM school_profiles WHERE school_id = $1",
      [schoolId]
    );

    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ error: "School not found" });
    }

    const uid = schoolRes.rows[0].submitted_by;

    // Get user details from users table
    const userRes = await pool.query(
      "SELECT * FROM users WHERE uid = $1",
      [uid]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];
    res.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });

  } catch (error) {
    console.error("Error fetching user by school ID:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// --- 2. GET: Check School by USER ID ---
app.get('/api/school-by-user/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    // Join with school_summary to get data quality issues
    const result = await pool.query(`
      SELECT 
        sp.*,
        ss.issues as data_quality_issues,
        ss.data_health_score,
        ss.data_health_description
      FROM school_profiles sp
      LEFT JOIN school_summary ss ON sp.school_id = ss.school_id
      WHERE sp.submitted_by = $1
    `, [uid]);
    if (result.rows.length > 0) {
      res.json({ exists: true, data: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("User Check Error:", err);
    res.status(500).json({ error: "Database check failed" });
  }
});

// --- 3. GET: Check by School ID ---
app.get('/api/check-school/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE school_id = $1', [id]);
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: "Check failed" });
  }
});

// --- 3b. GET: Fetch All Schools (For Admin Dashboard) ---
app.get('/api/schools', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        school_id AS "id", 
        school_name AS "name", 
        district, 
        'Submitted' AS "status" 
      FROM school_profiles 
      ORDER BY school_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Schools Error:", err);
    res.status(500).json({ error: "Failed to fetch schools" });
  }
});

// --- 3c. POST: Check if School is Already Registered ---
app.post('/api/check-existing-school', async (req, res) => {
  const { schoolId } = req.body;
  try {
    const result = await pool.query("SELECT school_id FROM school_profiles WHERE school_id = $1", [schoolId]);
    if (result.rows.length > 0) {
      return res.json({ exists: true, message: "This school is already registered." });
    }
    return res.json({ exists: false });
  } catch (error) {
    console.error("Check Existing Error:", error);
    return res.status(500).json({ error: "Database error checking school." });
  }
});

// --- 3d. POST: Register School Head (Finalize Registration) ---
// --- 3d. POST: Register School (One-Shot with Geofencing verification) ---
// api/index.js

// --- 3d. POST: Register School (One-Shot with Geofencing verification) ---
app.post('/api/register-school', async (req, res) => {
  const { uid, email, schoolData, contactNumber } = req.body;

  if (!uid || !schoolData || !schoolData.school_id) {
    return res.status(400).json({ error: "Missing required registration data." });
  }

  // DEBUG LOG
  console.log("âœ… REGISTRATION DATA:", {
    uid,
    school: schoolData.school_name
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. DUPLICATE CHECK
    const checkRes = await client.query("SELECT school_id FROM school_profiles WHERE school_id = $1", [schoolData.school_id]);
    if (checkRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "This school is already registered." });
    }

    // 2. GENERATE IERN (Sequential: YYYY-XXXXX)
    const year = new Date().getFullYear();
    const iernResult = await client.query(
      "SELECT iern FROM school_profiles WHERE iern LIKE $1 ORDER BY iern DESC LIMIT 1",
      [`${year}-%`]
    );

    let nextSeq = 1;
    if (iernResult.rows.length > 0) {
      const lastIern = iernResult.rows[0].iern;
      const parts = lastIern.split('-');
      if (parts.length === 2 && !isNaN(parts[1])) {
        const lastSeq = parseInt(parts[1], 10);
        nextSeq = lastSeq + 1;
      }
    }
    const newIern = `${year}-${String(nextSeq).padStart(5, '0')}`;

    // 3. CREATE USER (Optional)
    try {
      await client.query('SAVEPOINT user_creation');
      // Populate users table with School Head details and location from schoolData
      // schoolData keys: region, division, province, municipality (city), school_id, school_name
      await client.query(
        `INSERT INTO users (
            uid, email, role, created_at, contact_number,
            first_name, last_name, 
            region, division, province, city
         ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (uid) DO UPDATE SET 
            contact_number = EXCLUDED.contact_number,
            region = EXCLUDED.region,
            division = EXCLUDED.division,
            province = EXCLUDED.province,
            city = EXCLUDED.city;`,
        [
          uid,
          email,
          'School Head',
          valueOrNull(contactNumber),
          'School Head', // first_name
          schoolData.school_id, // last_name (using ID as per convention or could use Name)
          valueOrNull(schoolData.region),
          valueOrNull(schoolData.division),
          valueOrNull(schoolData.province),
          valueOrNull(schoolData.municipality) // stored as 'city' in users table
        ]
      );
      await client.query('RELEASE SAVEPOINT user_creation');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT user_creation');
      console.warn("User table insert failed, continuing...", e.message);
    }

    // 4. HYDRATE SCHOOL PROFILE
    const insertQuery = `
        INSERT INTO school_profiles (
            school_id, school_name, region, province, division, district, 
            municipality, leg_district, barangay, mother_school_id, 
            latitude, longitude, 
            submitted_by, iern, email, curricular_offering, submitted_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP
        )
    `;

    const values = [
      schoolData.school_id,
      schoolData.school_name,
      schoolData.region,
      schoolData.province,
      schoolData.division,
      schoolData.district,
      schoolData.municipality,
      schoolData.leg_district || schoolData.legislative,
      schoolData.barangay,
      schoolData.mother_school_id || 'NA',
      schoolData.latitude,
      schoolData.longitude,
      uid,
      newIern,
      email,
      normalizeOffering(schoolData.curricular_offering)
    ];

    await client.query(insertQuery, values);
    await client.query('COMMIT');

    // --- DUAL WRITE: REGISTER SCHOOL ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing School Registration...");
        const clientNew = await poolNew.connect();
        try {
          await clientNew.query('BEGIN');

          // 4a. Create User on Secondary
          await clientNew.query(
            "INSERT INTO users (uid, email, role, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (uid) DO NOTHING",
            [uid, email, 'School Head']
          );

          // 4b. Insert School Profile on Secondary
          // Check for existing first to avoid unique violation if backup is slightly synced
          const checkDup = await clientNew.query("SELECT school_id FROM school_profiles WHERE school_id = $1", [schoolData.school_id]);
          if (checkDup.rows.length === 0) {
            await clientNew.query(insertQuery, values);
          } else {
            console.log("âš ï¸ Secondary DB already has this school (Duplicate Check Hit).");
          }

          await clientNew.query('COMMIT');
          console.log("âœ… Dual-Write: School Registered on Secondary!");
        } catch (dwErr) {
          await clientNew.query('ROLLBACK');
          console.error("âŒ Dual-Write Error (Register School):", dwErr.message);
        } finally {
          clientNew.release();
        }
      } catch (connErr) {
        console.error("âŒ Dual-Write Connection Error:", connErr.message);
      }
    }

    console.log(`[SUCCESS] Registered School: ${schoolData.school_name} (${newIern})`);

    // SNAPSHOT UPDATE (Initialize Progress)
    try {
      await calculateSchoolProgress(schoolData.school_id, pool);
      if (poolNew) await calculateSchoolProgress(schoolData.school_id, poolNew);
    } catch (calcErr) {
      console.error("Warning: Failed to calculate initial progress:", calcErr.message);
      // Non-fatal, registration still succeeded
    }

    res.json({ success: true, iern: newIern, message: "School Registered Successfully" });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Register School Error:", err);
    res.status(500).json({ error: "Registration failed: " + err.message });
  } finally {
    client.release();
  }
});

// --- 3e. POST: Register Generic User (Engineer, RO, SDO) ---
app.post('/api/register-user', async (req, res) => {
  const { uid, email, role, firstName, lastName, region, division, province, city, barangay, office, position, contactNumber, altEmail } = req.body;

  if (!uid || !email || !role) {
    return res.status(400).json({ error: "Missing required fields (uid, email, role)" });
  }

  try {
    const query = `
            INSERT INTO users (
                uid, email, role, created_at,
                first_name, last_name,
                region, division, province, city, barangay,
                office, position, contact_number, alt_email
            ) VALUES (
                $1, $2, $3, CURRENT_TIMESTAMP,
                $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
            ON CONFLICT (uid) DO UPDATE SET
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                region = EXCLUDED.region,
                division = EXCLUDED.division,
                province = EXCLUDED.province,
                city = EXCLUDED.city,
                barangay = EXCLUDED.barangay,
                office = EXCLUDED.office,
                position = EXCLUDED.position,
                contact_number = EXCLUDED.contact_number,
                alt_email = EXCLUDED.alt_email;
        `;

    const values = [
      uid, email, role,
      valueOrNull(firstName), valueOrNull(lastName),
      valueOrNull(region), valueOrNull(division),
      valueOrNull(province), valueOrNull(city), valueOrNull(barangay),
      valueOrNull(office), valueOrNull(position),
      valueOrNull(contactNumber), valueOrNull(altEmail)
    ];

    await pool.query(query, values);
    console.log(`âœ… [DB] Synced generic user: ${email} (${role})`);

    // --- DUAL WRITE: REGISTER GENERIC USER ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Generic User...");
        await poolNew.query(query, values);
        console.log("âœ… Dual-Write: Generic User Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Register User):", dwErr.message);
      }
    }

    await logActivity(uid, `${firstName} ${lastName}`, role, 'REGISTER', 'User Profile', `Registered as ${role}`);

    res.json({ success: true, message: "User synced to Database" });
  } catch (err) {
    console.error("âŒ Register User Error:", err);
    res.status(500).json({ error: "Failed to sync user to Database" });
  }
});

// --- 3f. GET: Lookup Email by School ID (Smart Login) ---
app.get('/api/auth/lookup-email/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    // Query for an email that starts with the School ID
    // This covers both @deped.gov.ph and @insighted.app cases
    const result = await pool.query(
      "SELECT email FROM users WHERE email LIKE $1 LIMIT 1",
      [`${schoolId}@%`]
    );

    if (result.rows.length > 0) {
      return res.json({ found: true, email: result.rows[0].email });
    } else {
      return res.json({ found: false });
    }
  } catch (error) {
    console.error("Lookup Email Error:", error);
    res.status(500).json({ error: "Database error during lookup." });
  }
});

// ==================================================================
//                  SCHOOL HEAD FORMS ROUTES
// ==================================================================

// --- 5. GET: Cascading Location Endpoints ---
app.get('/api/locations/regions', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT region FROM schools WHERE region IS NOT NULL AND region != \'\' ORDER BY region ASC');
    res.json(result.rows.map(r => r.region));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/divisions', async (req, res) => {
  const { region } = req.query;
  try {
    const result = await pool.query('SELECT DISTINCT division FROM schools WHERE region = $1 AND division IS NOT NULL AND division != \'\' ORDER BY division ASC', [region]);
    res.json(result.rows.map(r => r.division));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/districts', async (req, res) => {
  const { region, division } = req.query;
  try {
    const result = await pool.query('SELECT DISTINCT district FROM schools WHERE region = $1 AND division = $2 AND district IS NOT NULL AND district != \'\' ORDER BY district ASC', [region, division]);
    res.json(result.rows.map(r => r.district));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/municipalities', async (req, res) => {
  const { region, division, district } = req.query;
  try {
    const result = await pool.query('SELECT DISTINCT municipality FROM schools WHERE region = $1 AND division = $2 AND district = $3 AND municipality IS NOT NULL AND municipality != \'\' ORDER BY municipality ASC', [region, division, district]);
    res.json(result.rows.map(r => r.municipality));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/schools', async (req, res) => {
  const { region, division, district, municipality } = req.query;
  try {
    const result = await pool.query('SELECT * FROM schools WHERE region = $1 AND division = $2 AND district = $3 AND municipality = $4 ORDER BY school_name ASC', [region, division, district, municipality]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. POST: Save School Profile (With Detailed Audit Log) ---
app.post('/api/save-school', async (req, res) => {
  const data = req.body;
  console.log("Saving School Profile. Payload received:", JSON.stringify(data, null, 2)); // DEBUG LOG
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. FETCH EXISTING DATA FIRST
    const checkQuery = 'SELECT * FROM school_profiles WHERE school_id = $1';
    const existingRes = await client.query(checkQuery, [data.schoolId]);
    const oldData = existingRes.rows[0];

    // 2. DETECT CHANGES
    let changes = [];
    let actionType = "Profile Created"; // Default for new rows
    let existingIern = oldData ? oldData.iern : null;

    if (oldData) {
      actionType = "Profile Updated";

      // List of fields to monitor for changes
      // (Map frontend keys to database columns)
      const fieldMap = {
        schoolName: 'school_name',
        region: 'region',
        province: 'province',
        division: 'division',
        district: 'district',
        municipality: 'municipality',
        legDistrict: 'leg_district',
        barangay: 'barangay',
        motherSchoolId: 'mother_school_id',
        latitude: 'latitude',
        longitude: 'longitude',
        curricularOffering: 'curricular_offering'
      };

      for (const [frontKey, dbCol] of Object.entries(fieldMap)) {
        const newValue = data[frontKey];
        const oldValue = oldData[dbCol];

        // Compare values (ignoring loose type differences like null vs undefined)
        // We trim strings to avoid false positives on whitespace
        const cleanNew = String(newValue || '').trim();
        const cleanOld = String(oldValue || '').trim();

        if (cleanNew !== cleanOld) {
          changes.push({
            field: dbCol,
            old_value: cleanOld || "N/A",
            new_value: cleanNew || "N/A"
          });
        }
      }
    }

    // 3. CREATE DETAILED LOG ENTRY
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      user: data.submittedBy,
      action: actionType,
      changes: changes // <--- Now includes the specific changes!
    };

    // 4. GENERATE IERN IF MISSING
    let finalIern = existingIern;
    if (!finalIern) {
      const year = new Date().getFullYear();
      const iernResult = await client.query(
        "SELECT iern FROM school_profiles WHERE iern LIKE $1 ORDER BY iern DESC LIMIT 1",
        [`${year}-%`]
      );

      let nextSeq = 1;
      if (iernResult.rows.length > 0) {
        const lastIern = iernResult.rows[0].iern;
        const parts = lastIern.split('-');
        if (parts.length === 2 && !isNaN(parts[1])) {
          const lastSeq = parseInt(parts[1], 10);
          nextSeq = lastSeq + 1;
        }
      }
      finalIern = `${year}-${String(nextSeq).padStart(5, '0')}`;
    }

    // 5. PERFORM INSERT OR UPDATE
    const query = `
      INSERT INTO school_profiles (
        school_id, school_name, region, province, division, district, 
        municipality, leg_district, barangay, mother_school_id, 
        latitude, longitude, submitted_by, submitted_at, 
        curricular_offering,
        history_logs,
        iern
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, 
        $14,
        jsonb_build_array($15::jsonb),
        $16
      )
      ON CONFLICT (school_id) 
      DO UPDATE SET 
        school_name = EXCLUDED.school_name,
        region = EXCLUDED.region,
        province = EXCLUDED.province,
        division = EXCLUDED.division,
        district = EXCLUDED.district,
        municipality = EXCLUDED.municipality,
        leg_district = EXCLUDED.leg_district,
        barangay = EXCLUDED.barangay,
        mother_school_id = EXCLUDED.mother_school_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        curricular_offering = EXCLUDED.curricular_offering,
        submitted_by = EXCLUDED.submitted_by,
        submitted_at = CURRENT_TIMESTAMP,
        history_logs = school_profiles.history_logs || $15::jsonb,
        iern = COALESCE(school_profiles.iern, EXCLUDED.iern);
    `;

    const values = [
      data.schoolId, data.schoolName, data.region, data.province,
      data.division, data.district, data.municipality, data.legDistrict,
      data.barangay, data.motherSchoolId, data.latitude, data.longitude,
      data.submittedBy,
      normalizeOffering(data.curricularOffering), // $14
      JSON.stringify(newLogEntry), // $15
      finalIern // $16
    ];

    await client.query(query, values);
    await client.query('COMMIT');

    // --- DUAL WRITE: SCHOOL PROFILE ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing School Profile...");
        const clientNew = await poolNew.connect();
        try {
          await clientNew.query('BEGIN');
          // Re-use logic: Insert/Update using the exact same IERN and Values
          // Note: values array includes finalIern at index 16 (derived from primary)
          await clientNew.query(query, values);
          await clientNew.query('COMMIT');
          console.log("âœ… Dual-Write: School Profile Synced!");

          // Calculate Snapshot on Secondary
          await calculateSchoolProgress(data.schoolId, poolNew);
        } catch (dwErr) {
          await clientNew.query('ROLLBACK');
          console.error("âŒ Dual-Write Error (Save School):", dwErr.message);
        } finally {
          clientNew.release();
        }
      } catch (connErr) {
        console.error("âŒ Dual-Write Connection Error (Save School):", connErr.message);
      }
    }

    // --- CENTRALIZED AUDIT LOGGING ---
    // Log to activity_logs table for Admin Dashboard visibility
    try {
      await logActivity(
        data.submittedBy,
        'School Head',
        'School Head',
        actionType === 'Profile Created' ? 'CREATE' : 'UPDATE',
        `School Profile: ${data.schoolId}`,
        `Submitted profile for ${data.schoolName}`
      );
    } catch (logErr) {
      console.error("Failed to log activity centrally:", logErr);
    }

    res.status(200).json({ message: "Profile saved successfully!", changes: changes, iern: finalIern });

    // SNAPSHOT UPDATE (Primary)
    await calculateSchoolProgress(data.schoolId, pool);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Save Error:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  } finally {
    client.release();
  }
});

// --- 4b. GET: Fetch Full School Profile ---
app.get('/api/school-profile/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE submitted_by = $1', [uid]);
    if (result.rows.length === 0) return res.json({ exists: false });
    // Return standard format expected by frontend
    res.json({
      exists: true,
      data: result.rows[0],
      school_id: result.rows[0].school_id,
      curricular_offering: result.rows[0].curricular_offering
    });
  } catch (err) {
    console.error("Fetch School Profile Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- 4c. GET: School By User (Alias for Compatibility) ---
app.get('/api/school-by-user/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE submitted_by = $1', [uid]);
    if (result.rows.length === 0) return res.json({ exists: false });
    res.json({
      exists: true,
      data: result.rows[0],
      school_id: result.rows[0].school_id,
      curricular_offering: result.rows[0].curricular_offering
    });
  } catch (err) {
    console.error("Fetch School By User Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- 5. POST: Save School Head Info (Updated to match Enrolment logic) ---
app.post('/api/save-school-head', async (req, res) => {
  const data = req.body;

  // Create a log entry similar to your enrolment logic
  const newLogEntry = {
    timestamp: new Date().toISOString(),
    user: data.uid,
    action: "School Head Info Update"
  };

  try {
    const query = `
      UPDATE school_profiles SET 
        head_last_name = $2,
        head_first_name = $3,
        head_middle_name = $4,
        head_item_number = $5,
        head_position_title = $6,
        head_date_hired = $7,
        updated_at = CURRENT_TIMESTAMP,
        history_logs = history_logs || $8::jsonb
      WHERE submitted_by = $1;
    `;

    const values = [
      data.uid,
      data.lastName || null,
      data.firstName || null,
      data.middleName || null,
      data.itemNumber || null,
      data.positionTitle || null,
      data.dateHired || null,
      JSON.stringify(newLogEntry)
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "School Profile not found. Please create the School Profile first." });
    }

    // --- CENTRALIZED AUDIT LOG ---
    await logActivity(
      data.uid,
      'School Head', // Ideally pass name from frontend, but role suffices if unknown
      'School Head',
      'UPDATE',
      'School Head Info',
      'Updated personal information'
    );

    res.json({ success: true, message: "School Head information updated successfully!" });

    // --- DUAL WRITE: SCHOOL HEAD ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing School Head...");
        await poolNew.query(query, values);
        console.log("âœ… Dual-Write: School Head Synced!");

        // Snapshot trigger logic repeated for secondary
        try {
          const spRes = await poolNew.query("SELECT school_id FROM school_profiles WHERE submitted_by = $1", [data.uid]);
          if (spRes.rows.length > 0) {
            await calculateSchoolProgress(spRes.rows[0].school_id, poolNew);
          }
        } catch (e) { console.warn("Secondary Snapshot Trigger Failed (School Head)", e); }

      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (School Head):", dwErr.message);
      }
    }

    // SNAPSHOT UPDATE - Need SchoolID first. The endpoint receives UID.
    // We can fetch school_id from result of update or query it.
    // Let's rely on submitted_by to find school_id.
    try {
      const spRes = await pool.query("SELECT school_id FROM school_profiles WHERE submitted_by = $1", [data.uid]);
      if (spRes.rows.length > 0) {
        await calculateSchoolProgress(spRes.rows[0].school_id, pool);
      }
    } catch (e) { console.warn("Snapshot Trigger User Lookup Failed", e); }

  } catch (err) {
    console.error("Save Head Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 6. GET: Get School Head Info ---
app.get('/api/school-head/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const query = `
      SELECT 
        head_last_name as last_name, 
        head_first_name as first_name, 
        head_middle_name as middle_name, 
        head_item_number as item_number, 
        head_position_title as position_title, 
        head_date_hired as date_hired,
        region, 
        division,
        updated_at
      FROM school_profiles 
      WHERE submitted_by = $1;
    `;
    const result = await pool.query(query, [uid]);

    if (result.rows.length > 0 && result.rows[0].last_name) {
      res.json({ exists: true, data: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("Get Head Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- 6b. GET: Get Enrolment Data ---
app.get('/api/enrolment/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE submitted_by = $1', [uid]);
    if (result.rows.length === 0) return res.json({ exists: false });
    res.json({ exists: true, data: result.rows[0], school_id: result.rows[0].school_id, curricular_offering: result.rows[0].curricular_offering });
  } catch (err) {
    console.error("Get Enrolment Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- SDO: UPDATE SCHOOL PROFILE ---
// Add this to api/index.js after the /api/enrolment/:uid endpoint (around line 2426)

app.post('/api/sdo/update-school-profile', async (req, res) => {
  const { sdoUid, schoolId, profileData } = req.body;

  if (!sdoUid || !schoolId || !profileData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify SDO permissions
    const sdoRes = await client.query(
      'SELECT role, division, region FROM users WHERE uid = $1',
      [sdoUid]
    );

    if (sdoRes.rows.length === 0 || sdoRes.rows[0].role !== 'School Division Office') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied: Must be SDO user' });
    }

    const sdoUser = sdoRes.rows[0];

    // 2. Verify school is in SDO's division
    const schoolRes = await client.query(
      'SELECT division, region, school_name FROM school_profiles WHERE school_id = $1',
      [schoolId]
    );

    if (schoolRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'School not found' });
    }

    const school = schoolRes.rows[0];

    if (school.division !== sdoUser.division) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: `School not in your division. School: ${school.division}, You: ${sdoUser.division}`
      });
    }

    // 3. Update school profile
    await client.query(`
      UPDATE school_profiles 
      SET 
        school_name = $1,
        region = $2,
        province = $3,
        municipality = $4,
        barangay = $5,
        division = $6,
        district = $7,
        leg_district = $8,
        mother_school_id = $9,
        latitude = $10,
        longitude = $11,
        curricular_offering = $12,
        submitted_at = CURRENT_TIMESTAMP
      WHERE school_id = $13
    `, [
      profileData.school_name || profileData.schoolName,
      profileData.region,
      profileData.province,
      profileData.municipality,
      profileData.barangay,
      profileData.division,
      profileData.district,
      profileData.leg_district || profileData.legDistrict,
      profileData.mother_school_id || profileData.motherSchoolId,
      profileData.latitude,
      profileData.longitude,
      profileData.curricular_offering || profileData.curricularOffering,
      schoolId
    ]);

    // 4. Log activity
    await client.query(`
      INSERT INTO activity_logs (user_uid, user_name, role, action_type, target_entity, details)
      VALUES ($1, 'SDO User', 'School Division Office', 'SDO_UPDATE_SCHOOL', $2, $3)
    `, [
      sdoUid,
      schoolId,
      `SDO updated profile for ${school.school_name} (${schoolId})`
    ]);

    await client.query('COMMIT');

    console.log(`âœ… SDO (${sdoUid}) updated school: ${schoolId}`);
    res.json({
      success: true,
      message: 'School profile updated successfully',
      schoolId: schoolId
    });

    // SNAPSHOT UPDATE
    await calculateSchoolProgress(schoolId, client);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('SDO Update Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});






// --- 5c. POST: Validate School Data (School Head Override) ---
app.post('/api/school/validate-data', async (req, res) => {
  const { schoolId, uid } = req.body;

  if (!schoolId || !uid) {
    return res.status(400).json({ message: 'Missing schoolId or uid.' });
  }

  try {
    const query = `
      UPDATE school_profiles
      SET school_head_validation = true
      WHERE school_id = $1
      RETURNING school_id;
    `;

    const result = await pool.query(query, [schoolId]);

    // --- DUAL WRITE: VALIDATION ---
    if (poolNew) {
      try {
        await poolNew.query(query, [schoolId]);
        console.log("âœ… Dual-Write: Validation synced!");
        // Trigger summary update on secondary
        await updateSchoolSummary(schoolId, poolNew);
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Validation):", dwErr.message);
      }
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "School Profile not found." });
    }

    // Log Activity (Direct Insert)
    try {
      await pool.query(`
        INSERT INTO activity_logs (uid, user_name, role, action_type, target_entity, details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uid, 'School Head', 'School Head', 'VALIDATE', `Data Validation: ${schoolId}`, `School Head affirmed data accuracy despite warnings.`]);
    } catch (logErr) {
      console.error("Failed to log activity:", logErr.message);
      // Constructive failure: Don't fail the validation just because logging failed
    }

    // Trigger Instant Summary Update
    await updateSchoolSummary(schoolId, pool);

    res.json({ success: true, message: "Data validated successfully." });

  } catch (err) {
    console.error("âŒ Data Validation Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// --- 6. GET: Fetch Enrolment ---


// ==================================================================
//                    ENGINEER FORMS ROUTES
// ==================================================================

// --- 7. POST: Save Enrolment (Fixed with snake_case and null safety) ---
app.post('/api/save-enrolment', async (req, res) => {
  const data = req.body;
  console.log('ðŸ“¥ RECEIVED ENROLMENT DATA:', JSON.stringify(data, null, 2));

  const newLogEntry = {
    timestamp: new Date().toISOString(),
    user: data.submittedBy,
    action: 'Enrolment Update',
    offering: data.curricularOffering
  };

  try {
    const query = `
      UPDATE school_profiles 
      SET 
        curricular_offering = $2,
        es_enrollment = $3, jhs_enrollment = $4, 
        shs_enrollment = $5, total_enrollment = $6,
        grade_kinder = $7, grade_1 = $8, grade_2 = $9, grade_3 = $10,
        grade_4 = $11, grade_5 = $12, grade_6 = $13,
        grade_7 = $14, grade_8 = $15, grade_9 = $16, grade_10 = $17,
        grade_11 = $18, grade_12 = $19,
        abm_11=$20, abm_12=$21, stem_11=$22, stem_12=$23,
        humss_11=$24, humss_12=$25, gas_11=$26, gas_12=$27,
        tvl_ict_11=$28, tvl_ict_12=$29, tvl_he_11=$30, tvl_he_12=$31,
        tvl_ia_11=$32, tvl_ia_12=$33, tvl_afa_11=$34, tvl_afa_12=$35,
        arts_11=$36, arts_12=$37, sports_11=$38, sports_12=$39,
        
        -- ARAL Fields
        aral_math_g1=$41, aral_read_g1=$42, aral_sci_g1=$43,
        aral_math_g2=$44, aral_read_g2=$45, aral_sci_g2=$46,
        aral_math_g3=$47, aral_read_g3=$48, aral_sci_g3=$49,
        aral_math_g4=$50, aral_read_g4=$51, aral_sci_g4=$52,
        aral_math_g5=$53, aral_read_g5=$54, aral_sci_g5=$55,
        aral_math_g6=$56, aral_read_g6=$57, aral_sci_g6=$58,
        aral_total=$59,

        submitted_at = CURRENT_TIMESTAMP,
        history_logs = history_logs || $40::jsonb
      WHERE school_id = $1;
    `;

    const values = [
      data.schoolId, data.curricularOffering,
      data.esTotal || 0, data.jhsTotal || 0, data.shsTotal || 0, data.grandTotal || 0,

      // Elementary (Corrected to use snake_case + null safety)
      data.grade_kinder || 0, data.grade_1 || 0, data.grade_2 || 0, data.grade_3 || 0,
      data.grade_4 || 0, data.grade_5 || 0, data.grade_6 || 0,

      // JHS (Corrected)
      data.grade_7 || 0, data.grade_8 || 0, data.grade_9 || 0, data.grade_10 || 0,

      // SHS (Corrected)
      data.grade_11 || 0, data.grade_12 || 0,
      data.abm_11 || 0, data.abm_12 || 0, data.stem_11 || 0, data.stem_12 || 0,
      data.humss_11 || 0, data.humss_12 || 0, data.gas_11 || 0, data.gas_12 || 0,
      data.tvl_ict_11 || 0, data.tvl_ict_12 || 0, data.tvl_he_11 || 0, data.tvl_he_12 || 0,
      data.tvl_ia_11 || 0, data.tvl_ia_12 || 0, data.tvl_afa_11 || 0, data.tvl_afa_12 || 0,
      data.arts_11 || 0, data.arts_12 || 0, data.sports_11 || 0, data.sports_12 || 0,

      JSON.stringify(newLogEntry),

      // ARAL Values
      data.aral_math_g1 || 0, data.aral_read_g1 || 0, data.aral_sci_g1 || 0,
      data.aral_math_g2 || 0, data.aral_read_g2 || 0, data.aral_sci_g2 || 0,
      data.aral_math_g3 || 0, data.aral_read_g3 || 0, data.aral_sci_g3 || 0,
      data.aral_math_g4 || 0, data.aral_read_g4 || 0, data.aral_sci_g4 || 0,
      data.aral_math_g5 || 0, data.aral_read_g5 || 0, data.aral_sci_g5 || 0,
      data.aral_math_g6 || 0, data.aral_read_g6 || 0, data.aral_sci_g6 || 0,
      data.aral_total || 0
    ];

    const result = await pool.query(query, values);

    // --- DUAL WRITE: SAVE ENROLMENT ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Enrolment to Secondary DB...");
        await poolNew.query(query, values);
        console.log("âœ… Dual-Write: Enrolment synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Enrolment):", dwErr.message);
      }
    }

    if (result.rowCount === 0) {
      console.error("âŒ School Profile not found for ID:", data.schoolId);
      return res.status(404).json({ message: "School Profile not found." });
    }

    // DEBUG: Immediate Verification
    const verify = await pool.query("SELECT grade_kinder, es_enrollment FROM school_profiles WHERE school_id = $1", [data.schoolId]);
    if (verify.rows.length > 0) {
      console.log("âœ… DB VERIFY: grade_kinder =", verify.rows[0].grade_kinder);
    }

    await logActivity(
      data.submittedBy, 'School Head', 'School Head', 'UPDATE',
      `Enrolment Data: ${data.schoolId}`,
      `Updated enrolment (Total: ${data.grandTotal})`
    );

    console.log("âœ… Enrolment updated successfully!");
    res.status(200).json({ message: "Enrolment updated successfully!" });
    // SNAPSHOT UPDATE
    await calculateSchoolProgress(data.schoolId, pool);

  } catch (err) {
    console.error("âŒ Enrolment Save Error:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  }
});

// --- 7b. POST: Update Curricular Offering (Completion Gate) ---
app.post('/api/update-offering', async (req, res) => {
  const { uid, schoolId, offering } = req.body;

  if (!uid || !schoolId || !offering) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    const query = `
      UPDATE school_profiles
      SET curricular_offering = $1
      WHERE school_id = $2
      RETURNING school_id;
    `;

    const result = await pool.query(query, [offering, schoolId]);

    // --- DUAL WRITE: UPDATE OFFERING ---
    if (poolNew) {
      try {
        await poolNew.query(query, [offering, schoolId]);
        console.log("âœ… Dual-Write: Offering synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Offering):", dwErr.message);
      }
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "School Profile not found." });
    }

    await logActivity(
      uid, 'School Head', 'School Head', 'UPDATE',
      `Curricular Offering: ${schoolId}`,
      `Set curricular offering to ${offering}`
    );

    res.json({ success: true, message: "Curricular offering updated." });

    // SNAPSHOT UPDATE
    await calculateSchoolProgress(schoolId, pool);

  } catch (err) {
    console.error("âŒ Update Offering Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// --- 8. POST: Save New Project (Updated for Images & Transactions) ---
// --- 8. POST: Save New Project (Updated for Images, Transactions & IPC) ---
app.post('/api/save-project', async (req, res) => {
  const data = req.body;

  if (!data.schoolName || !data.projectName || !data.schoolId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let client;
  let clientNew; // For secondary DB transaction

  try {
    client = await pool.connect();
    await client.query('BEGIN'); // Start Transaction

    // --- DUAL WRITE: START TRANSACTION ---
    if (poolNew) {
      try {
        clientNew = await poolNew.connect();
        await clientNew.query('BEGIN');
      } catch (connErr) {
        console.error("âŒ Dual-Write: Failed to start transaction:", connErr.message);
        clientNew = null; // Proceed without secondary sync
      }
    }

    // --- MIGRATION: ADD PDF COLUMNS IF NOT EXIST ---
    // MOVED TO initDB() AT STARTUP TO ENSURE COLUMNS EXIST IMMEDATELY

    // 1. Generate IPC (INF-YYYY-XXXXX)
    const year = new Date().getFullYear();
    const ipcResult = await client.query(
      "SELECT ipc FROM engineer_form WHERE ipc LIKE $1 ORDER BY ipc DESC LIMIT 1",
      [`INF-${year}-%`]
    );

    let nextSeq = 1;
    if (ipcResult.rows.length > 0) {
      const lastIpc = ipcResult.rows[0].ipc;
      const parts = lastIpc.split('-');
      if (parts.length === 3 && !isNaN(parts[2])) {
        nextSeq = parseInt(parts[2]) + 1;
      }
    }
    const newIpc = `INF-${year}-${String(nextSeq).padStart(5, '0')}`;

    // 2. Prepare Project Data
    const engineerName = await getUserFullName(data.uid);
    const resolvedEngineerName = engineerName || data.modifiedBy || 'Engineer';

    // Extract Documents
    const docs = data.documents || [];
    const powDoc = docs.find(d => d.type === 'POW')?.base64 || null;
    const dupaDoc = docs.find(d => d.type === 'DUPA')?.base64 || null;
    const contractDoc = docs.find(d => d.type === 'CONTRACT')?.base64 || null;

    const projectValues = [
      data.projectName, data.schoolName, data.schoolId,
      valueOrNull(data.region), valueOrNull(data.division),
      data.status || 'Not Yet Started', parseIntOrNull(data.accomplishmentPercentage),
      valueOrNull(data.statusAsOfDate), valueOrNull(data.targetCompletionDate),
      valueOrNull(data.actualCompletionDate), valueOrNull(data.noticeToProceed),
      valueOrNull(data.contractorName), parseNumberOrNull(data.projectAllocation),
      valueOrNull(data.batchOfFunds), valueOrNull(data.otherRemarks),
      data.uid,
      newIpc, // $17
      resolvedEngineerName, // $18
      valueOrNull(data.latitude), // $19
      valueOrNull(data.longitude), // $20
      powDoc, // $21
      dupaDoc, // $22
      contractDoc, // $23
      valueOrNull(data.constructionStartDate), // $24
      valueOrNull(data.projectCategory), // $25
      valueOrNull(data.scopeOfWork), // $26
      parseIntOrNull(data.numberOfClassrooms), // $27
      parseIntOrNull(data.numberOfSites), // $28
      parseIntOrNull(data.numberOfStoreys), // $29
      parseNumberOrNull(data.fundsUtilized) // $30
    ];

    const projectQuery = `
      INSERT INTO "engineer_form" (
        project_name, school_name, school_id, region, division,
        status, accomplishment_percentage, status_as_of,
        target_completion_date, actual_completion_date, notice_to_proceed,
        contractor_name, project_allocation, batch_of_funds, other_remarks,
        engineer_id, ipc, engineer_name, latitude, longitude,
        pow_pdf, dupa_pdf, contract_pdf,
        construction_start_date, project_category, scope_of_work,
        number_of_classrooms, number_of_sites, number_of_storeys, funds_utilized
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
      RETURNING project_id, project_name, ipc;
    `;

    // 3. Insert Project
    const projectResult = await client.query(projectQuery, projectValues);
    const newProject = projectResult.rows[0];
    const newProjectId = newProject.project_id;

    // 4. Insert Images (If they exist in the payload)
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const imageQuery = `
        INSERT INTO "engineer_image" (project_id, image_data, uploaded_by, category)
        VALUES ($1, $2, $3, $4)
      `;

      for (const imgItem of data.images) {
        // Handle both string (legacy) and object formats
        const imgData = typeof imgItem === 'string' ? imgItem : imgItem.image_data;
        const category = typeof imgItem === 'object' ? imgItem.category : 'Internal';

        await client.query(imageQuery, [newProjectId, imgData, data.uid, category]);
      }
    }

    // 5. NO External Document Table Insert needed (Stored in engineer_form)

    await client.query('COMMIT');

    // --- DUAL WRITE: REPLAY ON SECONDARY DB ---
    if (clientNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Replaying Project Creation...");

        // Ensure Schema Sync on Secondary (Quick check)
        await clientNew.query(`
          ALTER TABLE engineer_form 
          ADD COLUMN IF NOT EXISTS pow_pdf TEXT,
          ADD COLUMN IF NOT EXISTS dupa_pdf TEXT,
          ADD COLUMN IF NOT EXISTS contract_pdf TEXT;
        `).catch(() => { });

        // 1. Insert Project (Using SAME IPC and Data)
        const newProjRes = await clientNew.query(projectQuery, projectValues);
        const newProjIdSecondary = newProjRes.rows[0].project_id;

        // 2. Insert Images
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          const imageQuery = `
            INSERT INTO "engineer_image" (project_id, image_data, uploaded_by, category)
            VALUES ($1, $2, $3, $4)
          `;
          for (const imgItem of data.images) {
            const imgData = typeof imgItem === 'string' ? imgItem : imgItem.image_data;
            const category = typeof imgItem === 'object' ? imgItem.category : 'Internal';
            await clientNew.query(imageQuery, [newProjIdSecondary, imgData, data.uid, category]);
          }
        }

        await clientNew.query('COMMIT');
        console.log("âœ… Dual-Write: Project Creation Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Project Create):", dwErr.message);
        await clientNew.query('ROLLBACK').catch(() => { });
      }
    }

    // 5. Log Activity (Detailed for History)
    const logDetails = {
      action: "Project Created",
      ipc: newIpc,
      status: data.status || 'Not Yet Started',
      accomplishment: parseIntOrNull(data.accomplishmentPercentage) || 0,
      allocation: parseNumberOrNull(data.projectAllocation),
      timestamp: new Date().toISOString()
    };

    // Fix: Ensure we have a valid user name for the log
    // Fix: Ensure we have a valid user name for the log (Fetch from DB first)
    let finalUserName = await getUserFullName(data.uid);

    // Fallback to frontend provided data if DB fetch returns null
    if (!finalUserName) {
      finalUserName = data.modifiedBy;
    }

    // Final fallback
    if (!finalUserName || finalUserName === 'undefined') {
      finalUserName = "Engineer (Unknown)";
    }

    console.log("ðŸ“ Attempting to log CREATE activity for:", newIpc);

    try {
      await logActivity(
        data.uid,
        finalUserName,
        'Engineer',
        'CREATE',
        `Project: ${newProject.project_name} (${newIpc})`,
        JSON.stringify(logDetails)
      );
      console.log("âœ… Activity logged successfully for:", newIpc);
    } catch (logErr) {
      console.error("âš ï¸ Activity Log Error (Non-blocking):", logErr.message);
      console.error("âš ï¸ Log Payload:", { uid: data.uid, user: finalUserName, ipc: newIpc });
    }

    res.status(200).json({ message: "Project and images saved!", project: newProject, ipc: newIpc });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    if (clientNew) await clientNew.query('ROLLBACK').catch(e => console.error("Dual-Write Rollback Err:", e.message)); // Rollback secondary too
    console.error("âŒ SQL ERROR:", err.message);
    res.status(500).json({ message: "Database error", error: err.message });
  } finally {
    if (client) client.release();
    if (clientNew) clientNew.release();
  }
});
// --- 9. PUT: Update Project ---
// --- 9. PUT: Update Project (With History Logging) ---
app.put('/api/update-project/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  let client;
  let clientNew = null; // Fix: Define clientNew
  try {
    client = await pool.connect();
    if (poolNew) clientNew = await poolNew.connect(); // Fix: Connect if secondary DB exists

    await client.query('BEGIN');
    if (clientNew) await clientNew.query('BEGIN'); // Fix: Transaction for secondary too

    // 1. Fetch Existing Data for Comparison
    const oldRes = await client.query('SELECT * FROM "engineer_form" WHERE project_id = $1', [id]);
    if (oldRes.rows.length === 0) {
      await client.query('ROLLBACK');
      if (clientNew) await clientNew.query('ROLLBACK');
      return res.status(404).json({ message: "Project not found" });
    }
    const oldData = oldRes.rows[0];

    // 2. Prepare Data for New Row (Append History)
    // Fetch user name to ensure it's up-to-date
    let finalUserName = await getUserFullName(data.uid);
    if (!finalUserName) finalUserName = data.modifiedBy || 'Engineer (Unknown)';

    // Merge new data with old data (Snapshot concept)
    const newStatus = data.status || oldData.status;
    const newAccomplishment = parseIntOrNull(data.accomplishmentPercentage) !== null ? parseIntOrNull(data.accomplishmentPercentage) : oldData.accomplishment_percentage;
    const newStatusAsOf = valueOrNull(data.statusAsOfDate) || oldData.status_as_of;
    const newRemarks = valueOrNull(data.otherRemarks) || oldData.other_remarks;
    const newActualDate = valueOrNull(data.actualCompletionDate) || oldData.actual_completion_date;
    const newLat = valueOrNull(data.latitude) || oldData.latitude;
    const newLong = valueOrNull(data.longitude) || oldData.longitude;



    const insertValues = [
      oldData.project_name, oldData.school_name, oldData.school_id, oldData.region, oldData.division,
      newStatus, newAccomplishment, newStatusAsOf,
      valueOrNull(data.targetCompletionDate) || oldData.target_completion_date, // Allow update
      newActualDate,
      valueOrNull(data.noticeToProceed) || oldData.notice_to_proceed, // Allow update
      valueOrNull(data.contractorName) || oldData.contractor_name, // Allow update
      valueOrNull(data.projectAllocation) || oldData.project_allocation, // Allow update
      valueOrNull(data.batchOfFunds) || oldData.batch_of_funds, // Allow update
      newRemarks,
      oldData.engineer_id, // Preserve original engineer ID
      oldData.ipc,         // Preserve IPC to link history
      finalUserName,       // Update Name string
      newLat,              // $19
      newLong,             // $20
      data.pow_pdf ? data.pow_pdf : oldData.pow_pdf,           // $21: Update or Preserve POW
      data.dupa_pdf ? data.dupa_pdf : oldData.dupa_pdf,         // $22: Update or Preserve DUPA
      data.contract_pdf ? data.contract_pdf : oldData.contract_pdf, // $23: Update or Preserve CONTRACT
      valueOrNull(data.constructionStartDate) || oldData.construction_start_date, // $24
      valueOrNull(data.projectCategory) || oldData.project_category, // $25
      valueOrNull(data.scopeOfWork) || oldData.scope_of_work, // $26
      valueOrNull(data.numberOfClassrooms) || oldData.number_of_classrooms, // $27
      valueOrNull(data.numberOfStoreys) || oldData.number_of_storeys, // $28
      valueOrNull(data.numberOfSites) || oldData.number_of_sites, // $29
      valueOrNull(data.fundsUtilized) || oldData.funds_utilized // $30
    ];

    const insertQuery = `
      INSERT INTO "engineer_form" (
        project_name, school_name, school_id, region, division,
        status, accomplishment_percentage, status_as_of,
        target_completion_date, actual_completion_date, notice_to_proceed,
        contractor_name, project_allocation, batch_of_funds, other_remarks,
        engineer_id, ipc, engineer_name, latitude, longitude,
        pow_pdf, dupa_pdf, contract_pdf,
        construction_start_date, project_category, scope_of_work,
        number_of_classrooms, number_of_storeys, number_of_sites, funds_utilized
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, insertValues);

    // --- DUAL WRITE: UPDATE PROJECT ---
    if (clientNew) {
      try {
        // We need to fetch the OLD data from the secondary DB too to handle snapshot nicely?
        // Or just blindly insert the new row?
        // The `insertQuery` is an INSERT (Append Only).
        // It relies on `oldData` which came from Primary DB.
        // We can use the SAME `insertValues`!
        // The `insertValues` contains primitive data (status, etc.) and `finalUserName`.
        // It does NOT contain `project_id` reference (except implicitly? No, engineer_form PK is `project_id` serial).
        // Wait, `insertQuery` inserts a NEW row. 
        // Is `engineer_form` storing `school_id`? Yes.
        // History is tracked via `ipc`. 
        // As long as IPC matches, we are good.
        // The values array has IPC at index 17 ($17).

        await clientNew.query(insertQuery, insertValues);
        await clientNew.query('COMMIT');
        console.log("âœ… Dual-Write: Project Update Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Project Update Err:", dwErr.message);
        await clientNew.query('ROLLBACK').catch(() => { });
      }
    }
    const newData = result.rows[0];

    await client.query('COMMIT');

    // 3. Track Changes (History)
    const changes = [];
    if (oldData.status !== newData.status) changes.push(`Status: '${oldData.status}' -> '${newData.status}'`);
    if (oldData.accomplishment_percentage !== newData.accomplishment_percentage) changes.push(`Accomplishment: ${oldData.accomplishment_percentage}% -> ${newData.accomplishment_percentage}%`);
    if (oldData.other_remarks !== newData.other_remarks) changes.push(`Remarks updated`);

    // Create a detailed log object
    const historyLog = {
      action: "Project Update",
      ipc: newData.ipc,
      changes: changes, // List of human-readable changes
      snapshot: { // Save key metrics
        status: newData.status,
        accomplishment: newData.accomplishment_percentage,
        date: new Date().toISOString()
      }
    };

    // 4. Log Activity
    // Note: finalUserName is already computed above logic


    await logActivity(
      data.uid,
      finalUserName,
      'Engineer',
      'UPDATE',
      `Project: ${newData.project_name} (${newData.ipc || 'No IPC'})`,
      JSON.stringify(historyLog) // Storing structured history
    );

    res.json({ message: "Update successful", project: newData });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    if (clientNew) await clientNew.query('ROLLBACK').catch(() => { });
    console.error("âŒ Error updating project:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (client) client.release();
    if (clientNew) clientNew.release();
  }
});

// --- 10. GET: Get Projects (Filtered by Engineer) ---
app.get('/api/projects', async (req, res) => {
  try {
    // We catch the engineer_id sent from EngineerDashboard.jsx
    const { status, region, division, search, engineer_id } = req.query;
    let queryParams = [];
    let whereClauses = [];

    let sql = `
      WITH LatestProjects AS (
          SELECT DISTINCT ON (ipc) 
            project_id, school_name, project_name, school_id, division, region, status, ipc, engineer_name, engineer_id,
            accomplishment_percentage, project_allocation, batch_of_funds, contractor_name, other_remarks,
            status_as_of, target_completion_date, actual_completion_date, notice_to_proceed, latitude, longitude,
            construction_start_date, project_category, scope_of_work,
            number_of_classrooms, number_of_storeys, number_of_sites, funds_utilized
          FROM engineer_form
          ORDER BY ipc, project_id DESC
      )
      SELECT 
        p.project_id AS "id", p.school_name AS "schoolName", p.project_name AS "projectName",
        p.school_id AS "schoolId", p.division, p.region, p.status, p.ipc, p.engineer_name AS "engineerName",
        p.accomplishment_percentage AS "accomplishmentPercentage",
        p.project_allocation AS "projectAllocation", p.batch_of_funds AS "batchOfFunds",
        p.contractor_name AS "contractorName", p.other_remarks AS "otherRemarks",
        TO_CHAR(p.status_as_of, 'YYYY-MM-DD') AS "statusAsOfDate",
        TO_CHAR(p.target_completion_date, 'YYYY-MM-DD') AS "targetCompletionDate",
        TO_CHAR(p.actual_completion_date, 'YYYY-MM-DD') AS "actualCompletionDate",
        TO_CHAR(p.notice_to_proceed, 'YYYY-MM-DD') AS "noticeToProceed",
        TO_CHAR(p.construction_start_date, 'YYYY-MM-DD') AS "constructionStartDate",
        p.project_category AS "projectCategory", p.scope_of_work AS "scopeOfWork",
        p.number_of_classrooms AS "numberOfClassrooms", p.number_of_storeys AS "numberOfStoreys",
        p.number_of_sites AS "numberOfSites", p.funds_utilized AS "fundsUtilized",
        p.latitude, p.longitude
      FROM LatestProjects p
      LEFT JOIN school_profiles sp ON p.school_id = sp.school_id
    `;

    // 1. ADD FILTER: Only show projects belonging to this engineer
    if (engineer_id) {
      queryParams.push(engineer_id);
      whereClauses.push(`p.engineer_id = $${queryParams.length}`);
    }

    // 2. Add your existing filters
    if (status) {
      queryParams.push(status);
      whereClauses.push(`p.status = $${queryParams.length}`);
    }
    if (region) {
      queryParams.push(region);
      whereClauses.push(`p.region = $${queryParams.length}`);
    }
    if (division) {
      queryParams.push(division);
      whereClauses.push(`p.division = $${queryParams.length}`);
    }
    // NEW: Municipality Filter for LGU
    if (req.query.municipality) {
      queryParams.push(req.query.municipality);
      whereClauses.push(`sp.municipality = $${queryParams.length}`);
    }

    if (search) {
      queryParams.push(`%${search}%`);
      whereClauses.push(`(p.school_name ILIKE $${queryParams.length} OR p.project_name ILIKE $${queryParams.length})`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY p.project_id DESC`;

    const result = await pool.query(sql, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error("âŒ Error fetching projects:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});
// --- 11. GET: Get Single Project ---
app.get('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT 
        project_id AS "id", school_name AS "schoolName", project_name AS "projectName",
        school_id AS "schoolId", division, region, status, ipc,
        accomplishment_percentage AS "accomplishmentPercentage",
        project_allocation AS "projectAllocation", batch_of_funds AS "batchOfFunds",
        contractor_name AS "contractorName", other_remarks AS "otherRemarks",
        TO_CHAR(status_as_of, 'YYYY-MM-DD') AS "statusAsOfDate",
        TO_CHAR(target_completion_date, 'YYYY-MM-DD') AS "targetCompletionDate",
        TO_CHAR(actual_completion_date, 'YYYY-MM-DD') AS "actualCompletionDate",
        TO_CHAR(notice_to_proceed, 'YYYY-MM-DD') AS "noticeToProceed",
        TO_CHAR(construction_start_date, 'YYYY-MM-DD') AS "constructionStartDate",
        project_category AS "projectCategory", scope_of_work AS "scopeOfWork",
        latitude, longitude
      FROM "engineer_form" WHERE project_id = $1;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Project not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
// --- 11b. GET: Get Projects by School ID (For School Head Validation) ---
app.get('/api/projects-by-school-id/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const query = `
      SELECT 
        project_id AS "id", school_name AS "schoolName", project_name AS "projectName",
        school_id AS "schoolId", division, region, status, validation_status, ipc,
        validation_remarks AS "validationRemarks", validated_by AS "validatedBy",
        accomplishment_percentage AS "accomplishmentPercentage",
        project_allocation AS "projectAllocation", batch_of_funds AS "batchOfFunds",
        contractor_name AS "contractorName", other_remarks AS "otherRemarks",
        TO_CHAR(status_as_of, 'YYYY-MM-DD') AS "statusAsOfDate",
        TO_CHAR(target_completion_date, 'YYYY-MM-DD') AS "targetCompletionDate",
        TO_CHAR(actual_completion_date, 'YYYY-MM-DD') AS "actualCompletionDate",
        TO_CHAR(notice_to_proceed, 'YYYY-MM-DD') AS "noticeToProceed",
        TO_CHAR(construction_start_date, 'YYYY-MM-DD') AS "constructionStartDate",
        project_category AS "projectCategory", scope_of_work AS "scopeOfWork",
        latitude, longitude
      FROM engineer_form WHERE TRIM(school_id) = TRIM($1)
      ORDER BY project_id DESC;
    `;
    const result = await pool.query(query, [schoolId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Projects by School Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- 11c. POST: Validate Project (School Head) ---
app.post('/api/validate-project', async (req, res) => {
  const { projectId, status, userUid, userName, remarks } = req.body;
  try {
    const query = `
      UPDATE "engineer_form" 
      SET validation_status = $1, validation_remarks = $3, validated_by = $4
      WHERE project_id = $2;
    `;
    await pool.query(query, [status, projectId, remarks || '', userName]);

    await logActivity(
      userUid,
      userName || 'School Head',
      'School Head',
      'VALIDATE',
      `Project ID: ${projectId}`,
      `Marked as ${status}. Remarks: ${remarks || 'None'}`
    );

    res.json({ success: true, message: `Project ${status}` });

    // --- DUAL WRITE: VALIDATE PROJECT ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Project Validation...");
        await poolNew.query(query, [status, projectId, remarks || '', userName]);
        console.log("âœ… Dual-Write: Project Validation Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Validate Project):", dwErr.message);
      }
    }
  } catch (err) {
    console.error("Validation Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- 20. POST: Upload Project Image (Base64) ---
app.post('/api/upload-image', async (req, res) => {
  const { projectId, imageData, uploadedBy, category } = req.body;
  if (!projectId || !imageData) return res.status(400).json({ error: "Missing required data" });

  try {
    const query = `INSERT INTO engineer_image (project_id, image_data, uploaded_by, category) VALUES ($1, $2, $3, $4) RETURNING id;`;
    const result = await pool.query(query, [projectId, imageData, uploadedBy, category || 'Internal']);

    await logActivity(uploadedBy, 'Engineer', 'Engineer', 'UPLOAD', `Project ID: ${projectId}`, `Uploaded a new site image (${category || 'Internal'})`);
    res.status(201).json({ success: true, imageId: result.rows[0].id });

    // --- DUAL WRITE: UPLOAD IMAGE ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Project Image...");
        // Re-use query? Yes.
        // NOTE: The ID returned might be different on secondary, but we don't return it here for dual-write context.
        // We just ensure the image exists there.
        // However, we need to map the project_id correctly if it differs.
        // But for this simplified setup, we assume IPC/IDs are synced or we rely on the Primary ID logic (assuming simple replication).
        // Actually, in `save-project` we used the same parameters.
        // Ideally we should look up the project by IPC, but `upload-image` takes `projectId`.
        // If `projectId` (Serial PK) is different on Secondary, this will FAIL or attach to WRONG project.

        // Safer Approach: Look up project on Secondary by IPC?
        // But we don't have IPC here. We only have `projectId`.
        // We must fetch the IPC from Primary first to find the correct project on Secondary.

        // 1. Get IPC from Primary using projectId
        const ipcRes = await pool.query('SELECT ipc FROM engineer_form WHERE project_id = $1', [projectId]);
        if (ipcRes.rows.length > 0) {
          const ipc = ipcRes.rows[0].ipc;

          // 2. Insert into Secondary using Subquery for Project ID based on IPC
          const dwQuery = `
                INSERT INTO engineer_image (project_id, image_data, uploaded_by) 
                VALUES ((SELECT project_id FROM engineer_form WHERE ipc = $1), $2, $3);
            `;
          await poolNew.query(dwQuery, [ipc, imageData, uploadedBy]);
          console.log("âœ… Dual-Write: Project Image Synced via IPC!");
        }

      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Upload Image):", dwErr.message);
      }
    }
  } catch (err) {
    console.error("âŒ Image Upload Error:", err.message);
    res.status(500).json({ error: "Failed to save image to database" });
  }
});

// --- 21. GET: Fetch Project Images (Active) ---
app.get('/api/project-images/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    // FIXED: Included image_data so frontend can render them
    const query = `SELECT id, uploaded_by, created_at, image_data, category FROM engineer_image WHERE project_id = $1 ORDER BY created_at DESC;`;
    const result = await pool.query(query, [projectId]);
    res.json(result.rows);
  } catch (err) {
    console.error("âŒ Error fetching project images:", err.message);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// --- 21b. GET: Fetch Single Image Content (BLOB) ---
app.get('/api/image/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `SELECT image_data FROM engineer_image WHERE id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.json({ id, image_data: result.rows[0].image_data });
  } catch (err) {
    console.error("âŒ Error fetching image blob:", err.message);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

// --- 22. GET: Fetch All Images for an Engineer (METADATA ONLY) ---
app.get('/api/engineer-images/:engineerId', async (req, res) => {
  const { engineerId } = req.params;
  try {
    // OPTIMIZATION: Removed image_data, added id for on-demand fetch
    const query = `
      SELECT ei.id, ei.created_at, ef.school_name 
      FROM engineer_image ei
      LEFT JOIN engineer_form ef ON ei.project_id = ef.project_id
      WHERE ei.uploaded_by = $1 
      ORDER BY ei.created_at DESC;
    `;
    const result = await pool.query(query, [engineerId]);
    res.json(result.rows);
  } catch (err) {
    console.error("âŒ Error fetching engineer gallery:", err.message);
    res.status(500).json({ error: "Failed to fetch gallery" });
  }
});

// --- 15. GET: Get Organized Classes Data ---
app.get('/api/organized-classes/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    // Fetch offering AND class counts from the SAME table
    const query = `
            SELECT 
                school_id, school_name, curricular_offering,
                classes_kinder, classes_grade_1, classes_grade_2, classes_grade_3,
                classes_grade_4, classes_grade_5, classes_grade_6,
                classes_grade_7, classes_grade_8, classes_grade_9, classes_grade_10,
                classes_grade_11, classes_grade_12,
                
                cnt_less_kinder, cnt_within_kinder, cnt_above_kinder,
                cnt_less_g1, cnt_within_g1, cnt_above_g1,
                cnt_less_g2, cnt_within_g2, cnt_above_g2,
                cnt_less_g3, cnt_within_g3, cnt_above_g3,
                cnt_less_g4, cnt_within_g4, cnt_above_g4,
                cnt_less_g5, cnt_within_g5, cnt_above_g5,
                cnt_less_g6, cnt_within_g6, cnt_above_g6,
                cnt_less_g7, cnt_within_g7, cnt_above_g7,
                cnt_less_g8, cnt_within_g8, cnt_above_g8,
                cnt_less_g9, cnt_within_g9, cnt_above_g9,
                cnt_less_g10, cnt_within_g10, cnt_above_g10,
                cnt_less_g11, cnt_within_g11, cnt_above_g11,
                cnt_less_g12, cnt_within_g12, cnt_above_g12
            FROM school_profiles 
            WHERE submitted_by = $1
        `;

    const result = await pool.query(query, [uid]);

    if (result.rows.length === 0) return res.json({ exists: false });

    // Return structured data for the frontend
    const row = result.rows[0];
    res.json({
      exists: true,
      schoolId: row.school_id,
      offering: row.curricular_offering,
      data: {
        kinder: row.classes_kinder,
        grade_1: row.classes_grade_1, grade_2: row.classes_grade_2,
        grade_3: row.classes_grade_3, grade_4: row.classes_grade_4,
        grade_5: row.classes_grade_5, grade_6: row.classes_grade_6,
        grade_7: row.classes_grade_7, grade_8: row.classes_grade_8,
        grade_9: row.classes_grade_9, grade_10: row.classes_grade_10,
        grade_11: row.classes_grade_11, grade_12: row.classes_grade_12,

        cnt_less_kinder: row.cnt_less_kinder, cnt_within_kinder: row.cnt_within_kinder, cnt_above_kinder: row.cnt_above_kinder,
        cnt_less_g1: row.cnt_less_g1, cnt_within_g1: row.cnt_within_g1, cnt_above_g1: row.cnt_above_g1,
        cnt_less_g2: row.cnt_less_g2, cnt_within_g2: row.cnt_within_g2, cnt_above_g2: row.cnt_above_g2,
        cnt_less_g3: row.cnt_less_g3, cnt_within_g3: row.cnt_within_g3, cnt_above_g3: row.cnt_above_g3,
        cnt_less_g4: row.cnt_less_g4, cnt_within_g4: row.cnt_within_g4, cnt_above_g4: row.cnt_above_g4,
        cnt_less_g5: row.cnt_less_g5, cnt_within_g5: row.cnt_within_g5, cnt_above_g5: row.cnt_above_g5,
        cnt_less_g6: row.cnt_less_g6, cnt_within_g6: row.cnt_within_g6, cnt_above_g6: row.cnt_above_g6,
        cnt_less_g7: row.cnt_less_g7, cnt_within_g7: row.cnt_within_g7, cnt_above_g7: row.cnt_above_g7,
        cnt_less_g8: row.cnt_less_g8, cnt_within_g8: row.cnt_within_g8, cnt_above_g8: row.cnt_above_g8,
        cnt_less_g9: row.cnt_less_g9, cnt_within_g9: row.cnt_within_g9, cnt_above_g9: row.cnt_above_g9,
        cnt_less_g10: row.cnt_less_g10, cnt_within_g10: row.cnt_within_g10, cnt_above_g10: row.cnt_above_g10,
        cnt_less_g11: row.cnt_less_g11, cnt_within_g11: row.cnt_within_g11, cnt_above_g11: row.cnt_above_g11,
        cnt_less_g12: row.cnt_less_g12, cnt_within_g12: row.cnt_within_g12, cnt_above_g12: row.cnt_above_g12
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// --- 16. POST: Save Organized Classes (UPDATED) ---
// --- 16. POST: Save Organized Classes (UPDATED with Class Size Standards) ---
app.post('/api/save-organized-classes', async (req, res) => {
  const data = req.body;
  try {
    const query = `
            UPDATE school_profiles SET
                classes_kinder = $2, 
                classes_grade_1 = $3, classes_grade_2 = $4, classes_grade_3 = $5,
                classes_grade_4 = $6, classes_grade_5 = $7, classes_grade_6 = $8,
                classes_grade_7 = $9, classes_grade_8 = $10, classes_grade_9 = $11,
                classes_grade_10 = $12, classes_grade_11 = $13, classes_grade_12 = $14,
                
                cnt_less_kinder = $51, cnt_within_kinder = $52, cnt_above_kinder = $53,
                cnt_less_g1 = $15, cnt_within_g1 = $16, cnt_above_g1 = $17,
                cnt_less_g2 = $18, cnt_within_g2 = $19, cnt_above_g2 = $20,
                cnt_less_g3 = $21, cnt_within_g3 = $22, cnt_above_g3 = $23,
                cnt_less_g4 = $24, cnt_within_g4 = $25, cnt_above_g4 = $26,
                cnt_less_g5 = $27, cnt_within_g5 = $28, cnt_above_g5 = $29,
                cnt_less_g6 = $30, cnt_within_g6 = $31, cnt_above_g6 = $32,
                cnt_less_g7 = $33, cnt_within_g7 = $34, cnt_above_g7 = $35,
                cnt_less_g8 = $36, cnt_within_g8 = $37, cnt_above_g8 = $38,
                cnt_less_g9 = $39, cnt_within_g9 = $40, cnt_above_g9 = $41,
                cnt_less_g10 = $42, cnt_within_g10 = $43, cnt_above_g10 = $44,
                cnt_less_g11 = $45, cnt_within_g11 = $46, cnt_above_g11 = $47,
                cnt_less_g12 = $48, cnt_within_g12 = $49, cnt_above_g12 = $50,

                updated_at = CURRENT_TIMESTAMP
            WHERE school_id = $1
        `;

    const result = await pool.query(query, [
      data.schoolId,
      data.kinder,
      data.g1, data.g2, data.g3, data.g4, data.g5, data.g6,
      data.g7, data.g8, data.g9, data.g10,
      data.g11, data.g12,

      data.cntLessG1 || 0, data.cntWithinG1 || 0, data.cntAboveG1 || 0,
      data.cntLessG2 || 0, data.cntWithinG2 || 0, data.cntAboveG2 || 0,
      data.cntLessG3 || 0, data.cntWithinG3 || 0, data.cntAboveG3 || 0,
      data.cntLessG4 || 0, data.cntWithinG4 || 0, data.cntAboveG4 || 0,
      data.cntLessG5 || 0, data.cntWithinG5 || 0, data.cntAboveG5 || 0,
      data.cntLessG6 || 0, data.cntWithinG6 || 0, data.cntAboveG6 || 0,
      data.cntLessG7 || 0, data.cntWithinG7 || 0, data.cntAboveG7 || 0,
      data.cntLessG8 || 0, data.cntWithinG8 || 0, data.cntAboveG8 || 0,
      data.cntLessG9 || 0, data.cntWithinG9 || 0, data.cntAboveG9 || 0,
      data.cntLessG10 || 0, data.cntWithinG10 || 0, data.cntAboveG10 || 0,
      data.cntLessG11 || 0, data.cntWithinG11 || 0, data.cntAboveG11 || 0,
      data.cntLessG12 || 0, data.cntWithinG12 || 0, data.cntAboveG12 || 0,

      data.cntLessKinder || 0, data.cntWithinKinder || 0, data.cntAboveKinder || 0
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "School Profile not found (Check School ID)" });
    }

    res.json({ message: "Classes saved successfully!" });
    // SNAPSHOT UPDATE (Primary)
    await calculateSchoolProgress(data.schoolId, pool);

    // --- DUAL WRITE: SAVE ORGANIZED CLASSES ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Organized Classes...");
        // 1. Replay Update
        await poolNew.query(query, [
          data.schoolId,
          data.kinder,
          data.g1, data.g2, data.g3, data.g4, data.g5, data.g6,
          data.g7, data.g8, data.g9, data.g10,
          data.g11, data.g12,

          data.cntLessG1 || 0, data.cntWithinG1 || 0, data.cntAboveG1 || 0,
          data.cntLessG2 || 0, data.cntWithinG2 || 0, data.cntAboveG2 || 0,
          data.cntLessG3 || 0, data.cntWithinG3 || 0, data.cntAboveG3 || 0,
          data.cntLessG4 || 0, data.cntWithinG4 || 0, data.cntAboveG4 || 0,
          data.cntLessG5 || 0, data.cntWithinG5 || 0, data.cntAboveG5 || 0,
          data.cntLessG6 || 0, data.cntWithinG6 || 0, data.cntAboveG6 || 0,
          data.cntLessG7 || 0, data.cntWithinG7 || 0, data.cntAboveG7 || 0,
          data.cntLessG8 || 0, data.cntWithinG8 || 0, data.cntAboveG8 || 0,
          data.cntLessG9 || 0, data.cntWithinG9 || 0, data.cntAboveG9 || 0,
          data.cntLessG10 || 0, data.cntWithinG10 || 0, data.cntAboveG10 || 0,
          data.cntLessG11 || 0, data.cntWithinG11 || 0, data.cntAboveG11 || 0,
          data.cntLessG12 || 0, data.cntWithinG12 || 0, data.cntAboveG12 || 0,

          data.cntLessKinder || 0, data.cntWithinKinder || 0, data.cntAboveKinder || 0
        ]);

        // 2. Snapshot Update (Secondary)
        await calculateSchoolProgress(data.schoolId, poolNew);
        console.log("âœ… Dual-Write: Organized Classes Synced!");

      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Organized Classes):", dwErr.message);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- 17. GET: Get Teaching Personnel Data ---
app.get('/api/teaching-personnel/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const query = `
            SELECT 
                school_id, school_name, curricular_offering,
                teach_kinder, teach_g1, teach_g2, teach_g3, teach_g4, teach_g5, teach_g6,
                teach_g7, teach_g8, teach_g9, teach_g10,
                teach_g11, teach_g12,
                teach_multi_1_2, teach_multi_3_4, teach_multi_5_6, teach_multi_3plus_flag, teach_multi_3plus_count,
                
                -- Experience
                teach_exp_0_1, teach_exp_2_5, teach_exp_6_10,
                teach_exp_11_15, teach_exp_16_20, teach_exp_21_25,
                teach_exp_26_30, teach_exp_31_35, teach_exp_36_40,
                teach_exp_40_45
            FROM school_profiles 
            WHERE submitted_by = $1
        `;

    const result = await pool.query(query, [uid]);

    if (result.rows.length === 0) return res.json({ exists: false });

    const row = result.rows[0];
    res.json({
      exists: true,
      schoolId: row.school_id,
      offering: row.curricular_offering,
      data: {
        teach_kinder: row.teach_kinder,
        teach_g1: row.teach_g1, teach_g2: row.teach_g2, teach_g3: row.teach_g3,
        teach_g4: row.teach_g4, teach_g5: row.teach_g5, teach_g6: row.teach_g6,
        teach_g7: row.teach_g7, teach_g8: row.teach_g8, teach_g9: row.teach_g9, teach_g10: row.teach_g10,
        teach_g11: row.teach_g11, teach_g12: row.teach_g12,
        teach_multi_1_2: row.teach_multi_1_2, teach_multi_3_4: row.teach_multi_3_4, teach_multi_5_6: row.teach_multi_5_6,
        teach_multi_3plus_flag: row.teach_multi_3plus_flag,
        teach_multi_3plus_count: row.teach_multi_3plus_count,

        // Experience
        teach_exp_0_1: row.teach_exp_0_1,
        teach_exp_2_5: row.teach_exp_2_5,
        teach_exp_6_10: row.teach_exp_6_10,
        teach_exp_11_15: row.teach_exp_11_15,
        teach_exp_16_20: row.teach_exp_16_20,
        teach_exp_21_25: row.teach_exp_21_25,
        teach_exp_26_30: row.teach_exp_26_30,
        teach_exp_31_35: row.teach_exp_31_35,
        teach_exp_36_40: row.teach_exp_36_40,
        teach_exp_40_45: row.teach_exp_40_45
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// --- 18. POST: Save Teaching Personnel ---
// api/index.js

app.post('/api/save-teaching-personnel', async (req, res) => {
  const d = req.body;

  // Logging to verify what the backend "sees"
  console.log("ðŸ“¥ RECEIVED TEACHING PERSONNEL DATA:", JSON.stringify(d, null, 2));
  console.log("Saving for UID:", d.uid);

  try {
    const query = `
            UPDATE school_profiles 
            SET 
                teach_kinder = $2::INT, teach_g1 = $3::INT, teach_g2 = $4::INT, 
                teach_g3 = $5::INT, teach_g4 = $6::INT, teach_g7 = $7::INT, 
                teach_g8 = $8::INT, teach_g9 = $9::INT, teach_g10 = $10::INT, 
                teach_g11 = $11::INT, teach_g12 = $12::INT, teach_g5 = $13::INT, 
                teach_g6 = $14::INT,
                teach_multi_1_2 = $15::INT, teach_multi_3_4 = $16::INT, teach_multi_5_6 = $17::INT,
                teach_multi_3plus_flag = $18::BOOLEAN,
                teach_multi_3plus_count = $19::INT,
                
                -- Auto-Calculated Summaries
                teachers_es = $30::INT,
                teachers_jhs = $31::INT,
                teachers_shs = $32::INT,

                -- Experience Fields
                teach_exp_0_1 = $20::INT, teach_exp_2_5 = $21::INT, teach_exp_6_10 = $22::INT,
                teach_exp_11_15 = $23::INT, teach_exp_16_20 = $24::INT, teach_exp_21_25 = $25::INT,
                teach_exp_26_30 = $26::INT, teach_exp_31_35 = $27::INT, teach_exp_36_40 = $28::INT,
                teach_exp_40_45 = $29::INT,

                updated_at = CURRENT_TIMESTAMP
            WHERE TRIM(submitted_by) = TRIM($1)
            RETURNING school_id;
        `;

    // --- AUTO-CALCULATION LOGIC ---
    const t_es = (parseInt(d.teach_kinder) || 0) + (parseInt(d.teach_g1) || 0) + (parseInt(d.teach_g2) || 0) +
      (parseInt(d.teach_g3) || 0) + (parseInt(d.teach_g4) || 0) + (parseInt(d.teach_g5) || 0) + (parseInt(d.teach_g6) || 0) +
      (parseInt(d.teach_multi_1_2) || 0) + (parseInt(d.teach_multi_3_4) || 0) + (parseInt(d.teach_multi_5_6) || 0) + (parseInt(d.teach_multi_3plus_count) || 0);

    const t_jhs = (parseInt(d.teach_g7) || 0) + (parseInt(d.teach_g8) || 0) + (parseInt(d.teach_g9) || 0) + (parseInt(d.teach_g10) || 0);

    const t_shs = (parseInt(d.teach_g11) || 0) + (parseInt(d.teach_g12) || 0);

    const values = [
      d.uid,                          // $1
      d.teach_kinder || 0, d.teach_g1 || 0, d.teach_g2 || 0,
      d.teach_g3 || 0, d.teach_g4 || 0, d.teach_g7 || 0,
      d.teach_g8 || 0, d.teach_g9 || 0, d.teach_g10 || 0,
      d.teach_g11 || 0, d.teach_g12 || 0, d.teach_g5 || 0,
      d.teach_g6 || 0,
      d.teach_multi_1_2 || 0, d.teach_multi_3_4 || 0, d.teach_multi_5_6 || 0,
      d.teach_multi_3plus_flag || false,
      d.teach_multi_3plus_count || 0,
      // Experience Values (20-29)
      d.teach_exp_0_1 || 0, d.teach_exp_2_5 || 0, d.teach_exp_6_10 || 0, // 20-22
      d.teach_exp_11_15 || 0, d.teach_exp_16_20 || 0, d.teach_exp_21_25 || 0, // 23-25
      d.teach_exp_26_30 || 0, d.teach_exp_31_35 || 0, d.teach_exp_36_40 || 0, // 26-28
      d.teach_exp_40_45 || 0, // 29

      // Calculated Values (30-32)
      t_es, t_jhs, t_shs
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      console.error("âŒ SQL matched 0 rows for UID:", d.uid);
      return res.status(404).json({ error: "No matching record found in Database." });
    }

    console.log("âœ… Record Updated Successfully for School:", result.rows[0].school_id);
    await calculateSchoolProgress(result.rows[0].school_id, pool); // SNAPSHOT UPDATE (Primary)

    // --- DUAL WRITE: TEACHING PERSONNEL ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Teaching Personnel...");
        await poolNew.query(query, values);
        // Snapshot secondary
        await calculateSchoolProgress(result.rows[0].school_id, poolNew);
        console.log("âœ… Dual-Write: Teaching Personnel Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Teaching Personnel):", dwErr.message);
      }
    }

    res.json({ success: true });


  } catch (err) {
    console.error("âŒ Database Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 19. GET: Get Learning Modalities (From School Profile) ---
app.get('/api/learning-modalities/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const query = `
            SELECT * FROM school_profiles WHERE submitted_by = $1
        `;
    const result = await pool.query(query, [uid]);

    if (result.rows.length === 0) return res.json({ exists: false });

    const row = result.rows[0];
    res.json({
      exists: true,
      schoolId: row.school_id,
      offering: row.curricular_offering,
      data: row // We just send the whole row, frontend picks what it needs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// --- 20. POST: Save Learning Modalities (Update School Profile) ---
app.post('/api/save-learning-modalities', async (req, res) => {
  const data = req.body;
  try {
    const query = `
            UPDATE school_profiles SET
                shift_kinder = $2, shift_g1 = $3, shift_g2 = $4, shift_g3 = $5, shift_g4 = $6, shift_g5 = $7, shift_g6 = $8,
                shift_g7 = $9, shift_g8 = $10, shift_g9 = $11, shift_g10 = $12, shift_g11 = $13, shift_g12 = $14,

                mode_kinder = $15, mode_g1 = $16, mode_g2 = $17, mode_g3 = $18, mode_g4 = $19, mode_g5 = $20, mode_g6 = $21,
                mode_g7 = $22, mode_g8 = $23, mode_g9 = $24, mode_g10 = $25, mode_g11 = $26, mode_g12 = $27,

                adm_mdl = $28, adm_odl = $29, adm_tvi = $30, adm_blended = $31, adm_others = $32,
                updated_at = CURRENT_TIMESTAMP
            WHERE school_id = $1
        `;

    await pool.query(query, [
      data.schoolId,
      data.shift_kinder, data.shift_g1, data.shift_g2, data.shift_g3, data.shift_g4, data.shift_g5, data.shift_g6,
      data.shift_g7, data.shift_g8, data.shift_g9, data.shift_g10, data.shift_g11, data.shift_g12,

      data.mode_kinder, data.mode_g1, data.mode_g2, data.mode_g3, data.mode_g4, data.mode_g5, data.mode_g6,
      data.mode_g7, data.mode_g8, data.mode_g9, data.mode_g10, data.mode_g11, data.mode_g12,

      data.adm_mdl, data.adm_odl, data.adm_tvi, data.adm_blended, data.adm_others
    ]);

    res.json({ message: "Modalities saved successfully!" });
    // SNAPSHOT UPDATE (Primary)
    await calculateSchoolProgress(data.schoolId, pool);

    // --- DUAL WRITE: LEARNING MODALITIES ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Learning Modalities...");
        await poolNew.query(query, [
          data.schoolId,
          data.shift_kinder, data.shift_g1, data.shift_g2, data.shift_g3, data.shift_g4, data.shift_g5, data.shift_g6,
          data.shift_g7, data.shift_g8, data.shift_g9, data.shift_g10, data.shift_g11, data.shift_g12,

          data.mode_kinder, data.mode_g1, data.mode_g2, data.mode_g3, data.mode_g4, data.mode_g5, data.mode_g6,
          data.mode_g7, data.mode_g8, data.mode_g9, data.mode_g10, data.mode_g11, data.mode_g12,

          data.adm_mdl, data.adm_odl, data.adm_tvi, data.adm_blended, data.adm_others
        ]);
        await calculateSchoolProgress(data.schoolId, poolNew);
        console.log("âœ… Dual-Write: Learning Modalities Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Learning Modalities):", dwErr.message);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- 21. GET: School Resources Data ---
app.get('/api/school-resources/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE submitted_by = $1', [uid]);
    if (result.rows.length === 0) return res.json({ exists: false });
    res.json({ exists: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 22. POST: Save School Resources ---
app.post('/api/save-school-resources', async (req, res) => {
  const data = req.body;
  console.log(`[Resources] Saving SchoolID: ${data.schoolId}`);
  console.log(`[Resources] Buildable Space: ${data.res_buildable_space}`);
  try {
    const query = `
            UPDATE school_profiles SET
                res_toilets_male=$2, res_toilets_female=$3, res_toilets_pwd=$4, res_toilets_common=$25, 
                res_water_source=$5,
                res_sci_labs=$6, res_com_labs=$7, res_tvl_workshops=$8,
                
                res_ownership_type=$9, res_electricity_source=$10, res_buildable_space=$11,
                sha_category=$26,

                seats_kinder=$12, seats_grade_1=$13, seats_grade_2=$14, seats_grade_3=$15,
                seats_grade_4=$16, seats_grade_5=$17, seats_grade_6=$18,
                seats_grade_7=$19, seats_grade_8=$20, seats_grade_9=$21, seats_grade_10=$22,
                seats_grade_11=$23, seats_grade_12=$24,

                -- New Inventory Fields
                res_ecart_func=$27, res_ecart_nonfunc=$28,
                res_laptop_func=$29, res_laptop_nonfunc=$30,
                res_tv_func=$31, res_tv_nonfunc=$32,
                res_printer_func=$33, res_printer_nonfunc=$34,
                res_desk_func=$35, res_desk_nonfunc=$36,
                res_armchair_func=$37, res_armchair_nonfunc=$38,
                res_toilet_func=$39, res_toilet_nonfunc=$40,
                res_handwash_func=$41, res_handwash_nonfunc=$42,

                updated_at=CURRENT_TIMESTAMP
            WHERE school_id=$1
        `;
    const result = await pool.query(query, [
      data.schoolId, // $1

      data.res_toilets_male, data.res_toilets_female, data.res_toilets_pwd, // $2-4
      valueOrNull(data.res_water_source), // $5

      data.res_sci_labs, data.res_com_labs, data.res_tvl_workshops, // $6-8

      valueOrNull(data.res_ownership_type), valueOrNull(data.res_electricity_source), valueOrNull(data.res_buildable_space), // $9-11

      data.seats_kinder, data.seats_grade_1, data.seats_grade_2, data.seats_grade_3,
      data.seats_grade_4, data.seats_grade_5, data.seats_grade_6,
      data.seats_grade_7, data.seats_grade_8, data.seats_grade_9, data.seats_grade_10,
      data.seats_grade_11, data.seats_grade_12, // $12-24

      data.res_toilets_common, // $25
      valueOrNull(data.sha_category), // $26

      // New Inventory Values ($27-42)
      data.res_ecart_func || 0, data.res_ecart_nonfunc || 0,
      data.res_laptop_func || 0, data.res_laptop_nonfunc || 0,
      data.res_tv_func || 0, data.res_tv_nonfunc || 0,
      data.res_printer_func || 0, data.res_printer_nonfunc || 0,
      data.res_desk_func || 0, data.res_desk_nonfunc || 0,
      data.res_armchair_func || 0, data.res_armchair_nonfunc || 0,
      data.res_toilet_func || 0, data.res_toilet_nonfunc || 0,
      data.res_handwash_func || 0, data.res_handwash_nonfunc || 0
    ]);
    if (result.rowCount === 0) {
      console.warn(`[Resources] ID ${data.schoolId} not found.`);
      return res.status(404).json({ error: "School Profile not found" });
    }
    console.log("[Resources] Success");
    res.json({ message: "Resources saved!" });
    // SNAPSHOT UPDATE (Primary)
    await calculateSchoolProgress(data.schoolId, pool);

    // --- DUAL WRITE: SCHOOL RESOURCES ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing School Resources...");
        await poolNew.query(query, [
          data.schoolId,
          data.res_toilets_male, data.res_toilets_female, data.res_toilets_pwd, // $2-4
          valueOrNull(data.res_water_source), // $5

          data.res_sci_labs, data.res_com_labs, data.res_tvl_workshops, // $6-8

          valueOrNull(data.res_ownership_type), valueOrNull(data.res_electricity_source), valueOrNull(data.res_buildable_space), // $9-11

          data.seats_kinder, data.seats_grade_1, data.seats_grade_2, data.seats_grade_3,
          data.seats_grade_4, data.seats_grade_5, data.seats_grade_6,
          data.seats_grade_7, data.seats_grade_8, data.seats_grade_9, data.seats_grade_10,
          data.seats_grade_11, data.seats_grade_12, // $12-24

          data.res_toilets_common,
          valueOrNull(data.sha_category),

          // New Inventory Values ($27-42)
          data.res_ecart_func || 0, data.res_ecart_nonfunc || 0,
          data.res_laptop_func || 0, data.res_laptop_nonfunc || 0,
          data.res_tv_func || 0, data.res_tv_nonfunc || 0,
          data.res_printer_func || 0, data.res_printer_nonfunc || 0,
          data.res_desk_func || 0, data.res_desk_nonfunc || 0,
          data.res_armchair_func || 0, data.res_armchair_nonfunc || 0,
          data.res_toilet_func || 0, data.res_toilet_nonfunc || 0,
          data.res_handwash_func || 0, data.res_handwash_nonfunc || 0
        ]);
        await calculateSchoolProgress(data.schoolId, poolNew);
        console.log("âœ… Dual-Write: School Resources Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (School Resources):", dwErr.message);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



// --- 23. GET: Teacher Specialization Data ---
app.get('/api/teacher-specialization/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE submitted_by = $1', [uid]);
    if (result.rows.length === 0) return res.json({ exists: false });

    // DEBUG LOG
    const row = result.rows[0];
    console.log(`[GET Specialization] Gen: ${row.spec_general_major}, ECE: ${row.spec_ece_major}`);

    res.json({ exists: true, data: row });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 24. GET: Physical Facilities Data ---
app.get('/api/physical-facilities/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE submitted_by = $1', [uid]);
    if (result.rows.length === 0) return res.json({ exists: false });
    res.json({ exists: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 25. POST: Save Physical Facilities ---
app.post('/api/save-physical-facilities', async (req, res) => {
  const data = req.body;
  try {
    const query = `
            UPDATE school_profiles SET
                build_classrooms_total=$2, 
                build_classrooms_new=$3,
                build_classrooms_good=$4,
                build_classrooms_repair=$5,
                build_classrooms_demolition=$6,
                updated_at=CURRENT_TIMESTAMP
            WHERE school_id=$1
        `;
    await pool.query(query, [
      data.schoolId,
      data.build_classrooms_total,
      data.build_classrooms_new,
      data.build_classrooms_good,
      data.build_classrooms_repair,
      data.build_classrooms_demolition
    ]);
    res.json({ message: "Facilities saved!" });
    // SNAPSHOT UPDATE (Primary)
    await calculateSchoolProgress(data.schoolId, pool);

    // --- DUAL WRITE: PHYSICAL FACILITIES ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Physical Facilities...");
        await poolNew.query(query, [
          data.schoolId,
          data.build_classrooms_total,
          data.build_classrooms_new,
          data.build_classrooms_good,
          data.build_classrooms_repair,
          data.build_classrooms_demolition
        ]);
        await calculateSchoolProgress(data.schoolId, poolNew);
        console.log("âœ… Dual-Write: Physical Facilities Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Physical Facilities):", dwErr.message);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- 26. POST: Save Teacher Specialization ---
app.post('/api/save-teacher-specialization', async (req, res) => {
  const d = req.body;
  try {
    const query = `
            UPDATE school_profiles SET 
                spec_english_major=$2, spec_english_teaching=$3,

                spec_filipino_major=$4, spec_filipino_teaching=$5,
                spec_math_major=$6, spec_math_teaching=$7,
                spec_science_major=$8, spec_science_teaching=$9,
                spec_ap_major=$10, spec_ap_teaching=$11,
                spec_mapeh_major=$12, spec_mapeh_teaching=$13,
                spec_esp_major=$14, spec_esp_teaching=$15,
                spec_tle_major=$16, spec_tle_teaching=$17,
                spec_guidance=$18, spec_librarian=$19,
                spec_ict_coord=$20, spec_drrm_coord=$21,
                spec_general_teaching=$22,
                spec_ece_teaching=$23,
                spec_bio_sci_major=$24, spec_bio_sci_teaching=$25,
                spec_phys_sci_major=$26, spec_phys_sci_teaching=$27,
                spec_agri_fishery_major=$28, spec_agri_fishery_teaching=$29,
                spec_others_major=$30, spec_others_teaching=$31,
                updated_at = CURRENT_TIMESTAMP
            WHERE submitted_by = $1;
        `;
    const values = [
      d.uid,
      d.spec_english_major || 0, d.spec_english_teaching || 0,
      d.spec_filipino_major || 0, d.spec_filipino_teaching || 0,
      d.spec_math_major || 0, d.spec_math_teaching || 0,
      d.spec_science_major || 0, d.spec_science_teaching || 0,
      d.spec_ap_major || 0, d.spec_ap_teaching || 0,
      d.spec_mapeh_major || 0, d.spec_mapeh_teaching || 0,
      d.spec_esp_major || 0, d.spec_esp_teaching || 0,
      d.spec_tle_major || 0, d.spec_tle_teaching || 0,
      d.spec_guidance || 0, d.spec_librarian || 0,
      d.spec_ict_coord || 0, d.spec_drrm_coord || 0,
      d.spec_general_teaching || 0,
      d.spec_ece_teaching || 0,
      d.spec_bio_sci_major || 0, d.spec_bio_sci_teaching || 0,
      d.spec_phys_sci_major || 0, d.spec_phys_sci_teaching || 0,
      d.spec_agri_fishery_major || 0, d.spec_agri_fishery_teaching || 0,
      d.spec_others_major || 0, d.spec_others_teaching || 0
    ];

    // DEBUG LOGGING
    console.log(`[Specialization Save] UID: ${d.uid}`);
    console.log(`[Specialization Save] General Teaching: ${d.spec_general_teaching}, ECE Teaching: ${d.spec_ece_teaching}`);

    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: "Profile not found" });

    res.json({ success: true });
    // SNAPSHOT UPDATE (UID to School ID)
    try {
      const spRes = await pool.query("SELECT school_id FROM school_profiles WHERE submitted_by = $1", [d.uid]);
      if (spRes.rows.length > 0) {
        await calculateSchoolProgress(spRes.rows[0].school_id, pool);

        // --- DUAL WRITE: TEACHER SPECIALIZATION ---
        if (poolNew) {
          try {
            console.log("ðŸ”„ Dual-Write: Syncing Teacher Specialization...");
            await poolNew.query(query, values);
            await calculateSchoolProgress(spRes.rows[0].school_id, poolNew);
            console.log("âœ… Dual-Write: Teacher Specialization Synced!");
          } catch (dwErr) {
            console.error("âŒ Dual-Write Error (Teacher Specialization):", dwErr.message);
          }
        }
      }
    } catch (e) { console.warn("Snapshot Trigger Specialization User Lookup Failed", e); }

  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ==================================================================
//                    MONITORING & JURISDICTION ROUTES
// ==================================================================

// --- 25. GET: Monitoring Stats (RO / SDO) ---
app.get('/api/monitoring/stats', async (req, res) => {
  const { region, division } = req.query;
  try {
    // REFACTOR: Use 'schools' table as the base to get accurate TOTAL SCHOOLS count.
    // LEFT JOIN 'school_profiles' to get the progress data.
    let statsQuery = `
      SELECT 
        COUNT(s.school_id) as total_schools,
        -- Sum up the boolean flags (1 or 0) from school_profiles
        COALESCE(SUM(CASE WHEN sp.f1_profile > 0 THEN 1 ELSE 0 END), 0) as profile,
        COALESCE(SUM(CASE WHEN sp.f2_head > 0 THEN 1 ELSE 0 END), 0) as head,
        COALESCE(SUM(CASE WHEN sp.f3_enrollment > 0 THEN 1 ELSE 0 END), 0) as enrollment,
        COALESCE(SUM(CASE WHEN sp.f4_classes > 0 THEN 1 ELSE 0 END), 0) as organizedclasses,
        COALESCE(SUM(CASE WHEN sp.f9_shifting > 0 THEN 1 ELSE 0 END), 0) as shifting,
        COALESCE(SUM(CASE WHEN sp.f5_teachers > 0 THEN 1 ELSE 0 END), 0) as personnel,
        COALESCE(SUM(CASE WHEN sp.f6_specialization > 0 THEN 1 ELSE 0 END), 0) as specialization,
        COALESCE(SUM(CASE WHEN sp.f7_resources > 0 THEN 1 ELSE 0 END), 0) as resources,
        COALESCE(SUM(CASE WHEN sp.f10_stats > 0 THEN 1 ELSE 0 END), 0) as learner_stats,
        COALESCE(SUM(CASE WHEN sp.f8_facilities > 0 THEN 1 ELSE 0 END), 0) as facilities,
        
        -- Overall Completion (100%)
        COALESCE(COUNT(CASE WHEN sp.completion_percentage = 100 THEN 1 END), 0) as completed_schools_count,
        
        -- System Validated Count (Completed AND Excellent from school_summary OR Manually Validated)
        COALESCE(COUNT(CASE WHEN sp.completion_percentage = 100 AND (ss.data_health_description = 'Excellent' OR sp.school_head_validation = TRUE) THEN 1 END), 0) as validated_schools_count,
        -- For Validation Count (Completed AND NOT Excellent from school_summary)
        COALESCE(COUNT(CASE WHEN sp.completion_percentage = 100 AND ss.data_health_description IS NOT NULL AND ss.data_health_description != 'Excellent' THEN 1 END), 0) as for_validation_count
      FROM schools s
      LEFT JOIN school_profiles sp ON s.school_id = sp.school_id
      LEFT JOIN school_summary ss ON s.school_id = ss.school_id
      WHERE TRIM(s.region) = TRIM($1)
    `;
    let params = [region];

    if (division) {
      statsQuery += ` AND TRIM(s.division) = TRIM($2)`;
      params.push(division);
    }

    if (req.query.district) {
      statsQuery += ` AND TRIM(s.district) = TRIM($${params.length + 1})`;
      params.push(req.query.district);
    }

    const result = await pool.query(statsQuery, params);

    // Safety: Ensure we return numbers
    const row = result.rows[0];
    const safeRow = {
      total_schools: parseInt(row.total_schools || 0),
      profile: parseInt(row.profile || 0),
      head: parseInt(row.head || 0),
      enrollment: parseInt(row.enrollment || 0),
      organizedclasses: parseInt(row.organizedclasses || 0),
      shifting: parseInt(row.shifting || 0),
      personnel: parseInt(row.personnel || 0),
      specialization: parseInt(row.specialization || 0),
      resources: parseInt(row.resources || 0),
      facilities: parseInt(row.facilities || 0),
      learner_stats: parseInt(row.learner_stats || 0), // Added explicit return if needed
      completed_schools_count: parseInt(row.completed_schools_count || 0),
      validated_schools_count: parseInt(row.validated_schools_count || 0)
    };

    res.json(safeRow);
  } catch (err) {
    console.error("Monitoring Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- 25b. GET: Monitoring Stats per Division (RO View) ---
// --- 26. GET: Division Stats (Within Region) ---
app.get('/api/monitoring/division-stats', async (req, res) => {
  const { region } = req.query;
  console.log("DEBUG: FETCHING DIV STATS FOR REGION:", region);
  try {
    // REFACTOR: Use 'schools' table as base
    const query = `
      SELECT 
        s.division, 
        COUNT(s.school_id) as total_schools, 
        COUNT(CASE WHEN sp.completion_percentage = 100 THEN 1 END) as completed_schools,
        COUNT(CASE WHEN sp.completion_percentage = 100 AND (ss.data_health_description = 'Excellent' OR sp.school_head_validation = TRUE) THEN 1 END) as validated_schools,
        COUNT(CASE WHEN sp.completion_percentage = 100 AND ss.data_health_description IS NOT NULL AND ss.data_health_description != 'Excellent' THEN 1 END) as for_validation_schools,
        ROUND(COALESCE(AVG(sp.completion_percentage), 0), 1) as avg_completion
      FROM schools s
      LEFT JOIN school_profiles sp ON s.school_id = sp.school_id
      LEFT JOIN school_summary ss ON s.school_id = ss.school_id
      WHERE TRIM(s.region) = TRIM($1)
      GROUP BY s.division
      ORDER BY s.division
    `;

    const result = await pool.query(query, [region]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch division stats" });
  }
});

// --- 27. GET: District Stats (Within Division) ---
app.get('/api/monitoring/district-stats', async (req, res) => {
  const { region, division } = req.query;
  console.log("DEBUG: FETCHING DISTRICT STATS FOR:", region, division);
  try {
    // REFACTOR: Use 'schools' table as base
    const query = `
      SELECT 
        s.district,
        COUNT(s.school_id) as total_schools,
        COUNT(CASE WHEN sp.completion_percentage = 100 THEN 1 END) as completed_schools,
        COUNT(CASE WHEN sp.data_health_description IN ('Excellent', 'Good', 'Fair') OR sp.school_head_validation = TRUE THEN 1 END) as validated_schools,
        COUNT(CASE WHEN sp.data_health_description = 'Critical' THEN 1 END) as critical_schools,
        ROUND(COALESCE(AVG(sp.completion_percentage), 0), 1) as avg_completion
      FROM schools s
      LEFT JOIN school_profiles sp ON s.school_id = sp.school_id
      WHERE TRIM(s.region) = TRIM($1) AND TRIM(s.division) = TRIM($2)
      GROUP BY s.district
      ORDER BY s.district ASC
    `;

    const result = await pool.query(query, [region, division]);
    res.json(result.rows);
  } catch (err) {
    console.error("District Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch district stats" });
  }
});

// --- 26. GET: List Schools in Jurisdiction (Paginated) ---
app.get('/api/monitoring/schools', async (req, res) => {
  const { region, division, page, limit, search } = req.query;
  try {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    // Base WHERE using schools table (source of truth)
    let whereClauses = [`TRIM(s.region) = TRIM($1)`];
    let params = [region];

    if (division) {
      whereClauses.push(`TRIM(s.division) = TRIM($${params.length + 1})`);
      params.push(division);
    }

    if (req.query.district) {
      whereClauses.push(`TRIM(s.district) = TRIM($${params.length + 1})`);
      params.push(req.query.district);
    }

    if (search) {
      whereClauses.push(`(s.school_name ILIKE $${params.length + 1} OR s.school_id ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    // common SELECT fields with SAFE casting
    // We use schools table (s) for identity
    // We use school_profiles (sp) for status, handling NULLs with COALESCE
    const selectFields = `
      s.school_name,
      s.school_id,
      COALESCE(sp.total_enrollment, 0) as total_enrollment,
      
      (COALESCE(sp.f1_profile, 0) > 0) as profile_status,
      (COALESCE(sp.f2_head, 0) > 0) as head_status,
      (COALESCE(sp.f3_enrollment, 0) > 0) as enrollment_status,
      (COALESCE(sp.f4_classes, 0) > 0) as classes_status,
      (COALESCE(sp.f9_shifting, 0) > 0) as shifting_status,
      (COALESCE(sp.f5_teachers, 0) > 0) as personnel_status,
      (COALESCE(sp.f6_specialization, 0) > 0) as specialization_status,
      (COALESCE(sp.f7_resources, 0) > 0) as resources_status,
      (COALESCE(sp.f10_stats, 0) > 0) as learner_stats_status,
      (COALESCE(sp.f8_facilities, 0) > 0) as facilities_status,
      
      COALESCE(sp.completion_percentage, 0) as completion_percentage,
      sp.submitted_by,
      sp.school_head_validation,
      ss.data_health_description,
      ss.data_health_score
    `;

    // COUNT Query (Count from schools table)
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM schools s
      LEFT JOIN school_profiles sp ON s.school_id = sp.school_id
      LEFT JOIN school_summary ss ON s.school_id = ss.school_id
      WHERE ${whereClauses.join(' AND ')}
    `;
    const countRes = await pool.query(countQuery, params);
    const totalItems = parseInt(countRes.rows[0].total);

    // DATA Query
    const dataQuery = `
      SELECT ${selectFields}
      FROM schools s
      LEFT JOIN school_profiles sp ON s.school_id = sp.school_id
      LEFT JOIN school_summary ss ON s.school_id = ss.school_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY s.school_name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Add pagination params
    const queryParams = [...params, limitNum, offset];

    const result = await pool.query(dataQuery, queryParams);

    // Return structured response
    res.json({
      data: result.rows,
      total: totalItems,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalItems / limitNum)
    });
  } catch (err) {
    console.error("Jurisdiction Schools Error:", err);
    res.status(500).json({ error: "Failed to fetch schools", details: err.message });
  }
});

// --- 27. GET: Engineer Project Stats for Jurisdiction ---
app.get('/api/monitoring/engineer-stats', async (req, res) => {
  const { region, division } = req.query;
  try {
    let query = `
      SELECT 
        COUNT(*) as total_projects,
        AVG(e.accomplishment_percentage):: NUMERIC(10, 2) as avg_progress,
        COUNT(CASE WHEN e.status = 'Completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN e.status = 'Ongoing' THEN 1 END) as ongoing_count,
        COUNT(CASE WHEN e.status = 'Delayed' THEN 1 END) as delayed_count
      FROM engineer_form e
      JOIN school_profiles sp ON e.school_id = sp.school_id
      WHERE TRIM(sp.region) = TRIM($1)
    `;
    let params = [region];

    if (division) {
      query += ` AND TRIM(sp.division) = TRIM($2)`;
      params.push(division);
    }

    if (req.query.district) {
      query += ` AND TRIM(sp.district) = TRIM($${params.length + 1})`;
      params.push(req.query.district);
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Engineer Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch engineer stats" });
  }
});

// --- 28. GET: All Engineer Projects for Jurisdiction ---
app.get('/api/monitoring/engineer-projects', async (req, res) => {
  const { region, division } = req.query;
  try {
    let query = `
      SELECT
        e.project_id as id, e.project_name as "projectName", e.school_id as "schoolId", e.school_name as "schoolName",
        e.accomplishment_percentage as "accomplishmentPercentage", e.status, e.project_allocation as "projectAllocation",
        e.validation_status as "validation_status", e.status_as_of as "statusAsOfDate"
      FROM engineer_form e
      LEFT JOIN school_profiles sp ON e.school_id = sp.school_id
      WHERE TRIM(e.region) = TRIM($1)
    `;
    let params = [region];

    if (division) {
      query += ` AND TRIM(sp.division) = TRIM($2)`;
      params.push(division);
    }

    if (req.query.district) {
      query += ` AND TRIM(sp.district) = TRIM($${params.length + 1})`;
      params.push(req.query.district);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Jurisdiction Projects Error:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// --- 28. GET: Full School Profile for Monitor (by School ID) ---
app.get('/api/monitoring/school-detail/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE school_id = $1', [schoolId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "School not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch school details" });
  }
});

// --- 29. GET: Engineer Projects for a School (Monitor View) ---
app.get('/api/monitoring/school-projects/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const query = `
SELECT * FROM engineer_form WHERE school_id = $1 ORDER BY created_at DESC
  `;
    const result = await pool.query(query, [schoolId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// --- 30. GET: Leaderboard Data ---
// --- 30. GET: Leaderboard Data ---
app.get('/api/leaderboard', async (req, res) => {
  const { scope, filter } = req.query;

  try {
    // 1. NATIONAL SCOPE: Return list of REGIONS
    if (scope === 'national') {
      const query = `
        SELECT 
          region as name,
          ROUND(AVG(completion_percentage), 0) as avg_completion
        FROM school_profiles
        WHERE region IS NOT NULL
        GROUP BY region
        ORDER BY avg_completion DESC
      `;
      const result = await pool.query(query);
      return res.json({ regions: result.rows });
    }

    // 2. REGIONAL SCOPE or ALL DIVISIONS: Return list of DIVISIONS
    if (scope === 'national_divisions' || (scope === 'region' && filter)) {
      let query = `
        SELECT 
          division as name,
          ROUND(AVG(completion_percentage), 0) as avg_completion
        FROM school_profiles
        WHERE division IS NOT NULL
      `;
      const params = [];

      if (scope === 'region' && filter) {
        query += ` AND TRIM(region) = TRIM($1)`;
        params.push(filter);
      }

      query += ` GROUP BY division ORDER BY avg_completion DESC`;

      const result = await pool.query(query, params);
      return res.json({ divisions: result.rows });
    }

    // 3. DIVISION SCOPE: Return list of SCHOOLS
    if (scope === 'division' && filter) {
      const query = `
        SELECT 
          school_id, school_name, region, division, district,
          completion_percentage as completion_rate, -- ALIAS FOR FRONTEND
          updated_at
        FROM school_profiles
        WHERE TRIM(division) = TRIM($1)
        ORDER BY completion_percentage DESC, updated_at DESC LIMIT 50
      `;
      const result = await pool.query(query, [filter]);
      return res.json({ schools: result.rows });
    }

    // 4. FALLBACK (Top schools overall)
    const query = `
      SELECT 
        school_id, school_name, region, division, district,
        completion_percentage as completion_rate,
        updated_at
      FROM school_profiles
      WHERE completion_percentage > 0
      ORDER BY completion_percentage DESC LIMIT 10
    `;
    const result = await pool.query(query);
    res.json(result.rows);

  } catch (err) {
    console.error("Leaderboard Error:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// --- 30. GET: Leaderboard Data ---
// --- 30b. GET: Aggregated Regional Stats (For Central Office) ---
app.get('/api/monitoring/regions', async (req, res) => {
  try {
    const query = `
      SELECT 
          region as name,
          CAST(AVG(completion_percentage) AS DECIMAL(10,1)) as avg_completion,
          SUM(forms_completed_count) as total_forms_completed,
          COUNT(*) as total_schools,
          COUNT(CASE WHEN completion_percentage = 100 THEN 1 END) as completed_schools
      FROM school_profiles
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY avg_completion DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Region Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch region stats" });
  }
});



// ==================================================================
//                    NOTIFICATION ROUTES
// ==================================================================

// --- 31. POST: Send Notification ---
app.post('/api/notifications/send', async (req, res) => {
  const { recipientUid, senderUid, senderName, title, message, type } = req.body;
  try {
    const query = `
            INSERT INTO notifications(recipient_uid, sender_uid, sender_name, title, message, type)
VALUES($1, $2, $3, $4, $5, $6)
RETURNING *;
`;
    const result = await pool.query(query, [recipientUid, senderUid, senderName, title, message, type || 'alert']);

    // --- DUAL WRITE: SEND NOTIFICATION ---
    if (poolNew) {
      poolNew.query(query, [recipientUid, senderUid, senderName, title, message, type || 'alert'])
        .catch(e => console.error("Dual-Write Notification Error:", e.message));
    }

    // Log it
    await logActivity(senderUid, senderName, 'System', 'ALERT', `User: ${recipientUid} `, `Sent alert: ${title} `);

    res.json({ success: true, notification: result.rows[0] });
  } catch (err) {
    console.error("Send Notification Error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// --- 32. GET: Get Notifications for User ---
app.get('/api/notifications/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const query = `
SELECT * FROM notifications 
            WHERE recipient_uid = $1 
            ORDER BY created_at DESC 
            LIMIT 50;
`;
    const result = await pool.query(query, [uid]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Notifications Error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// --- 33. PUT: Mark Notification as Read ---
app.put('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);

    // --- DUAL WRITE: MARK NOTIFICATION READ ---
    if (poolNew) {
      poolNew.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id])
        .catch(e => console.error("Dual-Write Notif Read Error:", e.message));
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Mark Read Error:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
});
// --- 24. GET: Fetch Learner Statistics (Enhanced) ---
app.get('/api/learner-statistics/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    // Dynamically build the SELECT list to include all K-12 flat columns
    const categories = ['stat_sned', 'stat_disability', 'stat_als', 'stat_muslim', 'stat_ip', 'stat_displaced', 'stat_repetition', 'stat_overage', 'stat_dropout'];
    const grades = ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];

    let selectFields = [
      'school_id', 'curricular_offering', 'learner_stats_grids',
      'stat_sned_es', 'stat_sned_jhs', 'stat_sned_shs', // legacy/subtotal
      'stat_disability_es', 'stat_disability_jhs', 'stat_disability_shs',
      'stat_als_es', 'stat_als_jhs', 'stat_als_shs',
      // 'stat_muslim' cols are covered by the loop below as they follow standard naming now
      'stat_ip', 'stat_displaced', 'stat_repetition', 'stat_overage', 'stat_dropout_prev_sy', // grand totals
      'stat_ip_es', 'stat_ip_jhs', 'stat_ip_shs',
      'stat_displaced_es', 'stat_displaced_jhs', 'stat_displaced_shs',
      'stat_repetition_es', 'stat_repetition_jhs', 'stat_repetition_shs',
      'stat_overage_es', 'stat_overage_jhs', 'stat_overage_shs',
      'stat_dropout_es', 'stat_dropout_jhs', 'stat_dropout_shs'
    ];

    // Add all K-12 flat columns to fetch list
    categories.forEach(cat => {
      grades.forEach(g => {
        selectFields.push(`${cat}_${g}`);
      });
    });

    const query = `SELECT ${selectFields.join(', ')} FROM school_profiles WHERE submitted_by = $1`;

    const result = await pool.query(query, [uid]);

    if (result.rows.length > 0) {
      res.json({ exists: true, data: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("Fetch Learner Stats Error:", err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// --- 25. POST: Save Learner Statistics (Dynamic) ---
app.post('/api/save-learner-statistics', async (req, res) => {
  const data = req.body;
  try {
    const categories = ['stat_sned', 'stat_disability', 'stat_als', 'stat_muslim', 'stat_ip', 'stat_displaced', 'stat_repetition', 'stat_overage', 'stat_dropout'];
    const grades = ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];

    // Base fields to always update
    const fields = [
      'submitted_at = CURRENT_TIMESTAMP',
      'learner_stats_grids = $' + 2, // Keep JSONB as backup/source if needed

      // Single Totals/Legacy
      'stat_sned_es = $' + 3, 'stat_sned_jhs = $' + 4, 'stat_sned_shs = $' + 5,
      'stat_disability_es = $' + 6, 'stat_disability_jhs = $' + 7, 'stat_disability_shs = $' + 8,
      'stat_als_es = $' + 9, 'stat_als_jhs = $' + 10, 'stat_als_shs = $' + 11,

      'stat_ip = $' + 12, 'stat_displaced = $' + 13, 'stat_repetition = $' + 14,
      'stat_overage = $' + 15, 'stat_dropout_prev_sy = $' + 16,

      // New Subtotals
      'stat_ip_es = $' + 17, 'stat_ip_jhs = $' + 18, 'stat_ip_shs = $' + 19,
      'stat_displaced_es = $' + 20, 'stat_displaced_jhs = $' + 21, 'stat_displaced_shs = $' + 22,
      'stat_repetition_es = $' + 23, 'stat_repetition_jhs = $' + 24, 'stat_repetition_shs = $' + 25,
      'stat_overage_es = $' + 26, 'stat_overage_jhs = $' + 27, 'stat_overage_shs = $' + 28,
      'stat_dropout_es = $' + 29, 'stat_dropout_jhs = $' + 30, 'stat_dropout_shs = $' + 31
    ];

    const values = [
      data.schoolId, // $1 (WHERE clause)
      data.learner_stats_grids || {}, // $2

      parseIntOrNull(data.stat_sned_es), parseIntOrNull(data.stat_sned_jhs), parseIntOrNull(data.stat_sned_shs),
      parseIntOrNull(data.stat_disability_es), parseIntOrNull(data.stat_disability_jhs), parseIntOrNull(data.stat_disability_shs),
      parseIntOrNull(data.stat_als_es), parseIntOrNull(data.stat_als_jhs), parseIntOrNull(data.stat_als_shs),

      parseIntOrNull(data.stat_ip), parseIntOrNull(data.stat_displaced), parseIntOrNull(data.stat_repetition),
      parseIntOrNull(data.stat_overage), parseIntOrNull(data.stat_dropout_prev_sy),

      parseIntOrNull(data.stat_ip_es), parseIntOrNull(data.stat_ip_jhs), parseIntOrNull(data.stat_ip_shs),
      parseIntOrNull(data.stat_displaced_es), parseIntOrNull(data.stat_displaced_jhs), parseIntOrNull(data.stat_displaced_shs),
      parseIntOrNull(data.stat_repetition_es), parseIntOrNull(data.stat_repetition_jhs), parseIntOrNull(data.stat_repetition_shs),
      parseIntOrNull(data.stat_overage_es), parseIntOrNull(data.stat_overage_jhs), parseIntOrNull(data.stat_overage_shs),
      parseIntOrNull(data.stat_dropout_es), parseIntOrNull(data.stat_dropout_jhs), parseIntOrNull(data.stat_dropout_shs)
    ];

    // Dynamically add the ~100 flat K-12 columns to fields and values
    let paramIndex = 32; // Next available index
    categories.forEach(cat => {
      grades.forEach(g => {
        fields.push(`${cat}_${g} = $${paramIndex}`);
        values.push(parseIntOrNull(data[`${cat}_${g}`]));
        paramIndex++;
      });
    });

    const query = `UPDATE school_profiles SET ${fields.join(', ')} WHERE school_id = $1`;

    await pool.query(query, values);

    // --- DUAL WRITE: LEARNER STATISTICS ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing Learner Stats...");
        await poolNew.query(query, values);
        await calculateSchoolProgress(data.schoolId, poolNew);
        console.log("âœ… Dual-Write: Learner Stats Synced!");
      } catch (dwErr) {
        console.error("âŒ Dual-Write Error (Learner Stats):", dwErr.message);
      }
    }

    // Centrally log activity
    await logActivity(
      data.uid,
      data.userName,
      data.role,
      'UPDATE',
      'Learner Statistics',
      `Updated learner statistics for school ${data.schoolId}`
    );

    res.json({ success: true, message: "Learner statistics saved successfully!" });
    // SNAPSHOT UPDATE (Primary)
    await calculateSchoolProgress(data.schoolId, pool);

  } catch (err) {
    console.error("Save Learner Stats Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- GLOBAL ERROR HANDLER ---
// Ensures all errors return JSON, preventing HTML responses for API routes
app.use((err, req, res, next) => {
  console.error("Global API Error:", err);

  // Handle Body Parser JSON Syntax Errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: "Invalid JSON payload sent to server." });
  }

  // Default Error
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message
    });
  }
});

// ==================================================================
//                        SERVER STARTUP
// ==================================================================

// 1. FOR LOCAL DEVELOPMENT (runs when you type 'node api/index.js')


// Robust path comparison for Windows
// Robust path comparison for Windows
const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1];

console.log("Startup Check:");
console.log("  Executed:", executedFile);
console.log("  Current: ", currentFile);

/* 
   ON WINDOWS:
   Executed: E:\InsightEd-Mobile-PWA\api\index.js
   Current:  e:\InsightEd-Mobile-PWA\api\index.js
   
   Note the case difference (E: vs e:). 
   path.resolve() adjusts slashes but DOES NOT fix drive letter case on all Node versions.
   We will normalize to lowercase for comparison.
*/
const isMainModule = path.resolve(executedFile).toLowerCase() === path.resolve(currentFile).toLowerCase();

// --- 1. GLOBAL ERROR HANDLERS TO PREVENT SILENT CRASHES ---
process.on('uncaughtException', (err) => {
  console.error('âŒ UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('âŒ UNHANDLED REJECTION:', reason);
});

// Always start if strictly detected as main, OR if explicitly forced by env (fallback)
// Debugging Startup Logic
console.log('--- Startup Debug Info ---');
console.log('Executed File:', process.argv[1]);
console.log('Current File:', fileURLToPath(import.meta.url));
console.log('Is Main Module?', isMainModule);
console.log('Force Start Env?', process.env.START_SERVER);
console.log('--------------------------');

// --- TEMPORARY MIGRATION ENDPOINT (MOVED OUTSIDE FOR ACCESS) ---
app.get('/api/migrate-schema', async (req, res) => {
  try {
    const client = await pool.connect();
    const results = [];

    // 1. Add construction_start_date
    try {
      await client.query('ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS construction_start_date TIMESTAMP');
      results.push("Added construction_start_date");
    } catch (e) { results.push(`Failed construction_start_date: ${e.message}`); }

    // 2. Add project_category
    try {
      await client.query('ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS project_category TEXT');
      results.push("Added project_category");
    } catch (e) { results.push(`Failed project_category: ${e.message}`); }

    // 3. Add scope_of_work
    try {
      await client.query('ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS scope_of_work TEXT');
      results.push("Added scope_of_work");
    } catch (e) { results.push(`Failed scope_of_work: ${e.message}`); }

    // 4. Add number_of_classrooms
    try {
      await client.query('ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS number_of_classrooms INTEGER');
      results.push("Added number_of_classrooms");
    } catch (e) { results.push(`Failed number_of_classrooms: ${e.message}`); }

    // 5. Add number_of_sites
    try {
      await client.query('ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS number_of_sites INTEGER');
      results.push("Added number_of_sites");
    } catch (e) { results.push(`Failed number_of_sites: ${e.message}`); }

    // 6. Add number_of_storeys
    try {
      await client.query('ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS number_of_storeys INTEGER');
      results.push("Added number_of_storeys");
    } catch (e) { results.push(`Failed number_of_storeys: ${e.message}`); }

    // 7. Add funds_utilized
    try {
      await client.query('ALTER TABLE "engineer_form" ADD COLUMN IF NOT EXISTS funds_utilized NUMERIC');
      results.push("Added funds_utilized");
    } catch (e) { results.push(`Failed funds_utilized: ${e.message}`); }

    // 4. Add head_sex to school_profiles -- REMOVED
    // try {
    //   await client.query('ALTER TABLE "school_profiles" ADD COLUMN IF NOT EXISTS head_sex TEXT');
    //   results.push("Added head_sex to school_profiles");
    // } catch (e) { results.push(`Failed head_sex: ${e.message}`); }

    client.release();
    res.json({ message: "Migration attempt finished", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (isMainModule || process.env.START_SERVER === 'true') {


  const PORT = process.env.PORT || 3000;




  const server = app.listen(PORT, () => {
    console.log(`\nðŸš€ SERVER RUNNING ON PORT ${PORT} `);
    console.log(`ðŸ‘‰ API Endpoint: http://localhost:${PORT}/api/send-otp`);
    console.log(`ðŸ‘‰ CORS Allowed Origins: http://localhost:5173, https://insight-ed-mobile-pwa.vercel.app\n`);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`âŒ Port ${PORT} is already in use! Please close the other process or use a different port.`);
    } else {
      console.error("âŒ Server Error:", e);
    }
  });
}


// 2. FOR VERCEL (Production)
// Export default is required for ESM in Vercel
export default app;

// --- DEBUG ENDPOINT ---
app.get('/api/debug/health-stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COALESCE(data_health_description, 'NULL') as status, 
        COUNT(*) as count 
      FROM school_profiles 
      WHERE completion_percentage = 100 
      GROUP BY data_health_description
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================================================================
//                      USER INFO HELPER
// ==================================================================
app.get('/api/user-info/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT role, first_name, last_name FROM users WHERE uid = $1', [uid]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================================================================
//                      LGU FORMS ROUTES
// ==================================================================

// --- LGU 1. POST: Save New Project (LGU) ---
app.post('/api/lgu/save-project', async (req, res) => {
  const data = req.body;

  if (!data.schoolName || !data.projectName || !data.schoolId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let client;
  let clientNew;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Dual Write Setup
    if (poolNew) {
      try {
        clientNew = await poolNew.connect();
        await clientNew.query('BEGIN');
      } catch (connErr) {
        console.error("⚠️ Dual-Write LGU: Failed to start transaction:", connErr.message);
        clientNew = null;
      }
    }

    // 1. Generate IPC (LGU-YYYY-XXXXX)
    const year = new Date().getFullYear();
    const ipcResult = await client.query(
      "SELECT ipc FROM lgu_forms WHERE ipc LIKE $1 ORDER BY ipc DESC LIMIT 1",
      [`LGU-${year}-%`]
    );

    let nextSeq = 1;
    if (ipcResult.rows.length > 0) {
      const lastIpc = ipcResult.rows[0].ipc;
      const parts = lastIpc.split('-');
      if (parts.length === 3 && !isNaN(parts[2])) {
        nextSeq = parseInt(parts[2]) + 1;
      }
    }
    const newIpc = `LGU-${year}-${String(nextSeq).padStart(5, '0')}`;

    // 2. Prepare Data
    const lguName = await getUserFullName(data.uid);
    const resolvedLguName = lguName || data.submittedBy || 'LGU User';

    const docs = data.documents || [];
    const powDoc = docs.find(d => d.type === 'POW')?.base64 || null;
    const dupaDoc = docs.find(d => d.type === 'DUPA')?.base64 || null;
    const contractDoc = docs.find(d => d.type === 'CONTRACT')?.base64 || null;

    const projectValues = [
      data.projectName, data.schoolName, data.schoolId,
      valueOrNull(data.region), valueOrNull(data.division),
      data.status || 'Not Yet Started', parseIntOrNull(data.accomplishmentPercentage),
      valueOrNull(data.statusAsOfDate), valueOrNull(data.targetCompletionDate),
      valueOrNull(data.actualCompletionDate), valueOrNull(data.noticeToProceed),
      valueOrNull(data.contractorName), parseNumberOrNull(data.projectAllocation),
      valueOrNull(data.batchOfFunds), valueOrNull(data.otherRemarks),
      data.uid,           // lgu_id
      newIpc,
      resolvedLguName,    // lgu_name
      valueOrNull(data.latitude),
      valueOrNull(data.longitude),
      powDoc,
      dupaDoc,
      contractDoc,
      // --- NEW FIELDS ---
      valueOrNull(data.moa_date), // 24
      parseIntOrNull(data.tranches_count), // 25
      parseNumberOrNull(data.tranche_amount), // 26
      valueOrNull(data.fund_source), // 27
      valueOrNull(data.province), // 28
      valueOrNull(data.city), // 29
      valueOrNull(data.municipality), // 30
      valueOrNull(data.legislative_district), // 31
      valueOrNull(data.scope_of_works), // 32
      parseNumberOrNull(data.contract_amount), // 33
      valueOrNull(data.bid_opening_date), // 34
      valueOrNull(data.resolution_award_date), // 35
      valueOrNull(data.procurement_stage), // 36
      valueOrNull(data.bidding_date), // 37
      valueOrNull(data.awarding_date), // 38
      valueOrNull(data.construction_start_date), // 39
      parseNumberOrNull(data.funds_downloaded), // 40
      parseNumberOrNull(data.funds_utilized) // 41
    ];

    const projectQuery = `
      INSERT INTO "lgu_forms" (
        project_name, school_name, school_id, region, division,
        status, accomplishment_percentage, status_as_of,
        target_completion_date, actual_completion_date, notice_to_proceed,
        contractor_name, project_allocation, batch_of_funds, other_remarks,
        lgu_id, ipc, lgu_name, latitude, longitude,
        pow_pdf, dupa_pdf, contract_pdf,
        -- NEW COLUMNS
        moa_date, tranches_count, tranche_amount, fund_source,
        province, city, municipality, legislative_district,
        scope_of_works, contract_amount, bid_opening_date,
        resolution_award_date, procurement_stage, bidding_date,
        awarding_date, construction_start_date, funds_downloaded,
        funds_utilized
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41
      )
      RETURNING project_id, project_name, ipc;
    `;

    // 3. Insert Project
    const projectResult = await client.query(projectQuery, projectValues);
    const newProject = projectResult.rows[0];
    const newProjectId = newProject.project_id;

    // 4. Insert Images
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const imageQuery = `
        INSERT INTO "lgu_image" (project_id, image_data, uploaded_by)
        VALUES ($1, $2, $3)
      `;
      for (const imgBase64 of data.images) {
        await client.query(imageQuery, [newProjectId, imgBase64, data.uid]);
      }
    }

    await client.query('COMMIT');

    // Dual Write Replay
    if (clientNew) {
      try {
        await clientNew.query(projectQuery, projectValues);
        // We need to fetch the ID from secondary to insert images correctly if sequence differs, 
        // but for now assuming synced or just using payload logic (Wait, project_id is serial, so checking ipc is safer)

        const newProjRes = await clientNew.query("SELECT project_id FROM lgu_forms WHERE ipc = $1", [newIpc]);
        if (newProjRes.rows.length > 0) {
          const secProjId = newProjRes.rows[0].project_id;
          if (data.images && Array.isArray(data.images)) {
            const imageQuery = `INSERT INTO "lgu_image" (project_id, image_data, uploaded_by) VALUES ($1, $2, $3)`;
            for (const imgBase64 of data.images) {
              await clientNew.query(imageQuery, [secProjId, imgBase64, data.uid]);
            }
          }
        }
        await clientNew.query('COMMIT');
        console.log("✅ Dual-Write: LGU Project Synced!");
      } catch (dwErr) {
        console.error("❌ Dual-Write LGU Error:", dwErr.message);
        await clientNew.query('ROLLBACK').catch(() => { });
      }
    }

    // 5. Log Activity
    const logDetails = {
      action: "LGU Project Created",
      ipc: newIpc,
      status: data.status,
      timestamp: new Date().toISOString()
    };

    await logActivity(
      data.uid, resolvedLguName, 'LGU', 'CREATE',
      `LGU Project: ${newProject.project_name} (${newIpc})`,
      JSON.stringify(logDetails)
    );

    res.status(200).json({ message: "LGU Project saved!", project: newProject, ipc: newIpc });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    if (clientNew) await clientNew.query('ROLLBACK').catch(() => { });
    console.error("❌ LGU Save Error:", err.message);
    res.status(500).json({ message: "Database error", error: err.message });
  } finally {
    if (client) client.release();
    if (clientNew) clientNew.release();
  }
});

// --- LGU 2. POST: Upload Image (LGU) ---
app.post('/api/lgu/upload-image', async (req, res) => {
  const { projectId, imageData, uploadedBy } = req.body;
  if (!projectId || !imageData) return res.status(400).json({ error: "Missing required data" });

  try {
    const query = `INSERT INTO lgu_image (project_id, image_data, uploaded_by) VALUES ($1, $2, $3) RETURNING id;`;
    const result = await pool.query(query, [projectId, imageData, uploadedBy]);

    await logActivity(uploadedBy, 'LGU User', 'LGU', 'UPLOAD', `LGU Project ID: ${projectId}`, `Uploaded image`);

    res.status(201).json({ success: true, imageId: result.rows[0].id });

    // Dual Write
    if (poolNew) {
      try {
        // Need to map project_id if sequences drifted, but simple logic for now:
        // Ideally we pass IPC, but here we only have ID. 
        // Warning: ID mismatch risk.
        // Safe way: SELECT ipc FROM lgu_forms WHERE project_id = $1 -> Then on secondary SELECT project_id FROM lgu_forms WHERE ipc = ...

        const ipcRes = await pool.query("SELECT ipc FROM lgu_forms WHERE project_id = $1", [projectId]);
        if (ipcRes.rows.length > 0) {
          const ipc = ipcRes.rows[0].ipc;
          await poolNew.query(`
                    INSERT INTO lgu_image (project_id, image_data, uploaded_by)
                    VALUES ((SELECT project_id FROM lgu_forms WHERE ipc = $1), $2, $3)
                `, [ipc, imageData, uploadedBy]);
          console.log("✅ Dual-Write: LGU Image Synced!");
        }
      } catch (dwErr) {
        console.error("❌ Dual-Write LGU Image Error:", dwErr.message);
      }
    }

  } catch (err) {
    console.error("❌ LGU Image Upload Error:", err.message);
    res.status(500).json({ error: "Failed to save image" });
  }
});

