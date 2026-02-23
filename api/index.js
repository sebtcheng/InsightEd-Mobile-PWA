import dotenv from 'dotenv';
import express from 'express';
import pg from 'pg';
import cors from 'cors';
// import cron from 'node-cron'; // REMOVED for Vercel
import admin from 'firebase-admin'; // --- FIREBASE ADMIN ---
import nodemailer from 'nodemailer'; // --- NODEMAILER ---
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initOtpTable, runMigrations } from './db_init.js';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs'; // Added for seed
import csv from 'csv-parser'; // Added for seed
import { createRequire } from "module"; // Added for JSON import
const require = createRequire(import.meta.url);
import { exec } from 'child_process';


// Load environment variables
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
// Robust .env parsing for UTF-16LE support
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
  try {
    let envContent = fs.readFileSync('.env', 'utf16le');
    let match = envContent.match(/DATABASE_URL=(.+)/);
    if (!match) {
      envContent = fs.readFileSync('.env', 'utf8');
      match = envContent.match(/DATABASE_URL=(.+)/);
    }
    if (match) {
      dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
      // Inject into env for other modules if needed
      process.env.DATABASE_URL = dbUrl;
    }
  } catch (e) {
    console.error("⚠️ Failed to manually parse .env:", e.message);
  }
}

// Fallback to local if still missing
const defaultLocal = 'postgres://postgres:password@localhost:5432/postgres';
if (!dbUrl) dbUrl = defaultLocal;

const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

console.log(`🔌 Database Connection: ${isLocal ? 'Local' : 'Remote'} (${dbUrl.replace(/:[^:@]*@/, ':****@')})`);

const pool = new Pool({
  connectionString: dbUrl,
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

    // --- MIGRATION: REMOVE FRAUD DETECTION COLUMNS FROM SCHOOL_PROFILES ---
    // User requested these be exclusively in school_summary EXCEPT FOR school_head_validation
    await pool.query(`
      ALTER TABLE school_profiles
      ADD COLUMN IF NOT EXISTS school_head_validation BOOLEAN DEFAULT FALSE,
      DROP COLUMN IF EXISTS data_health_score,
      DROP COLUMN IF EXISTS data_health_description,
      DROP COLUMN IF EXISTS forms_to_recheck;
    `);




    // --- MIGRATION: LGU FORMS AND IMAGES (REMOVED) ---
    /*
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lgu_forms (
        project_id SERIAL PRIMARY KEY,
        finance_id INT, -- Link to CO Finance if applicable
        total_funds NUMERIC,
        fund_released NUMERIC,
        date_of_release DATE,
        school_id TEXT,
        school_name TEXT,
        project_name TEXT,
        region TEXT,
        division TEXT, 
        district TEXT,
        legislative_district TEXT,
        status TEXT,
        
        -- Liquidation Columns
        liquidated_amount NUMERIC DEFAULT 0,
        liquidation_date TIMESTAMP,
        percentage_liquidated NUMERIC DEFAULT 0,

        lgu_id TEXT, -- To track which LGU user owns this
        
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
        ALTER TABLE lgu_forms
        ADD COLUMN IF NOT EXISTS source_agency TEXT,
        ADD COLUMN IF NOT EXISTS lsb_resolution_no TEXT,
        ADD COLUMN IF NOT EXISTS moa_ref_no TEXT,
        ADD COLUMN IF NOT EXISTS validity_period TEXT,
        ADD COLUMN IF NOT EXISTS contract_duration TEXT,
        ADD COLUMN IF NOT EXISTS date_approved_pow DATE,
        ADD COLUMN IF NOT EXISTS fund_release_schedule TEXT,
        ADD COLUMN IF NOT EXISTS mode_of_procurement TEXT,
        ADD COLUMN IF NOT EXISTS philgeps_ref_no TEXT,
        ADD COLUMN IF NOT EXISTS pcab_license_no TEXT,
        ADD COLUMN IF NOT EXISTS date_contract_signing DATE,
        ADD COLUMN IF NOT EXISTS bid_amount NUMERIC,
        ADD COLUMN IF NOT EXISTS nature_of_delay TEXT,
        ADD COLUMN IF NOT EXISTS date_notice_of_award DATE;
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
    console.log("✅ DB Init: LGU Schema SKIPPED (Removed in cleanup).");
    */

    // --- MIGRATION: ADD IPC TO ENGINEER_IMAGE AND BACKFILL ---
    await pool.query(`
      ALTER TABLE engineer_image ADD COLUMN IF NOT EXISTS ipc TEXT;
      
      UPDATE engineer_image ei
      SET ipc = ef.ipc
      FROM engineer_form ef
      WHERE ei.project_id = ef.project_id
      AND ei.ipc IS NULL;
    `);
    console.log("✅ DB Init: Engineer Image IPC column verified and backfilled.");


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

    // --- MIGRATION: ADD IPC TO ENGINEER_IMAGE (SECONDARY DB) ---
    if (poolNew) {
      try {
        await poolNew.query(`ALTER TABLE engineer_image ADD COLUMN IF NOT EXISTS ipc TEXT; `);
        console.log("✅ DB Init: Secondary DB schema synced (engineer_image + ipc).");
      } catch (err) {
        console.error("⚠️ Secondary DB Schema Sync Error:", err.message);
      }
    }
    // --- MIGRATION: ADD BUILDABLE SPACES ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buildable_spaces (
        space_id SERIAL PRIMARY KEY,
        school_id TEXT REFERENCES school_profiles(school_id),
        iern TEXT,
        space_number INTEGER,
        latitude NUMERIC,
        longitude NUMERIC,
        length NUMERIC,
        width NUMERIC,
        total_area NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add columns if they don't exist (for existing tables)
    await pool.query(`ALTER TABLE buildable_spaces ADD COLUMN IF NOT EXISTS iern TEXT;`);
    await pool.query(`ALTER TABLE buildable_spaces ADD COLUMN IF NOT EXISTS space_number INTEGER;`);

    await pool.query(`
      ALTER TABLE school_profiles
      ADD COLUMN IF NOT EXISTS has_buildable_space BOOLEAN;
    `);
    console.log("✅ DB Init: Buildable Spaces schema verified.");

    // --- MIGRATION: ADD FACILITY REPAIRS ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS facility_repairs (
        repair_id SERIAL PRIMARY KEY,
        school_id TEXT REFERENCES school_profiles(school_id),
        iern TEXT,
        building_no TEXT,
        room_no TEXT,
        repair_roofing BOOLEAN DEFAULT FALSE,
        repair_ceiling_ext BOOLEAN DEFAULT FALSE,
        repair_ceiling_int BOOLEAN DEFAULT FALSE,
        repair_wall_ext BOOLEAN DEFAULT FALSE,
        repair_partition BOOLEAN DEFAULT FALSE,
        repair_door BOOLEAN DEFAULT FALSE,
        repair_windows BOOLEAN DEFAULT FALSE,
        repair_flooring BOOLEAN DEFAULT FALSE,
        repair_structural BOOLEAN DEFAULT FALSE,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_facility_repairs_iern ON facility_repairs(iern);`);
    console.log("✅ DB Init: Facility Repairs schema verified.");

    // --- MIGRATION: ADD FACILITY DEMOLITIONS ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS facility_demolitions (
        demolition_id SERIAL PRIMARY KEY,
        school_id TEXT REFERENCES school_profiles(school_id),
        iern TEXT,
        building_no TEXT,
        reason_age BOOLEAN DEFAULT FALSE,
        reason_safety BOOLEAN DEFAULT FALSE,
        reason_calamity BOOLEAN DEFAULT FALSE,
        reason_upgrade BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_facility_demolitions_iern ON facility_demolitions(iern);`);
    console.log("✅ DB Init: Facility Demolitions schema verified.");

    // --- MIGRATION: ADD FACILITY INVENTORY ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS facility_inventory(
      id SERIAL PRIMARY KEY,
      school_id TEXT,
      iern TEXT,
      building_name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      no_of_storeys INTEGER DEFAULT 1,
      no_of_classrooms INTEGER NOT NULL,
      year_completed INTEGER,
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_facility_inventory_iern ON facility_inventory(iern); `);
    console.log("✅ DB Init: Facility Inventory schema verified.");

  } catch (err) {
    console.error("âŒ DB Init Error:", err);
  }
};
// initDB(); // Moved to awaited startup

// --- DATABASE INIT (EXTENDED FOR FINANCE) ---
const initFinanceDB = async () => {
  try {
    // 1. Create Finance Projects Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS finance_projects (
        finance_id SERIAL PRIMARY KEY,
        root_id TEXT, -- For Append-Only History
        region TEXT,
        division TEXT,
        district TEXT,
        legislative_district TEXT,
        school_id TEXT,
        school_name TEXT,
        project_name TEXT,
        total_funds NUMERIC,
        fund_released NUMERIC,
        date_of_release DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- MIGRATION: Add root_id to finance_projects if missing ---
    await pool.query(`ALTER TABLE finance_projects ADD COLUMN IF NOT EXISTS root_id TEXT;`);
    // Backfill root_id for existing
    await pool.query(`UPDATE finance_projects SET root_id = 'FIN-' || finance_id WHERE root_id IS NULL;`);

    console.log("✅ DB Init: Finance Projects table verified.");

    // 2. DROP OBSOLETE TABLE
    await pool.query(`DROP TABLE IF EXISTS lgu_forms CASCADE; `);
    console.log("✅ DB Init: Dropped obsolete 'lgu_forms' table.");

    // 3. Create/Update LGU Finance Projects Table (lgu_projects)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lgu_projects (
        lgu_project_id SERIAL PRIMARY KEY,
        region TEXT,
        division TEXT,
        district TEXT,
        legislative_district TEXT,
        school_id TEXT,
        school_name TEXT,
        project_name TEXT,
        total_funds NUMERIC,
        fund_released NUMERIC,
        date_of_release DATE,
        liquidated_amount NUMERIC DEFAULT 0,
        liquidation_date DATE,
        percentage_liquidated NUMERIC DEFAULT 0,
        finance_id INTEGER, -- Link to CO Finance
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- NEW FIELDS (LGU Refactor)
        source_agency TEXT,
      contractor_name TEXT,
      lsb_resolution_no TEXT,
      moa_ref_no TEXT,
      moa_date DATE,
      validity_period TEXT,
      contract_duration TEXT,
      date_approved_pow DATE,
      approved_contract_budget NUMERIC,
      schedule_of_fund_release TEXT, -- 'Lumpsum' or 'Tranches'
        number_of_tranches INTEGER,
      amount_per_tranche NUMERIC,
      mode_of_procurement TEXT,
      philgeps_ref_no TEXT,
      pcab_license_no TEXT,
      date_contract_signing DATE,
      date_notice_of_award DATE,
      bid_amount NUMERIC,
      latitude TEXT,
      longitude TEXT,

      --DOCUMENTS
        pow_pdf TEXT,
      dupa_pdf TEXT,
      contract_pdf TEXT,

      --PROGRESS
        project_status TEXT DEFAULT 'Not Yet Started',
      accomplishment_percentage NUMERIC DEFAULT 0,
      status_as_of_date DATE,
      amount_utilized NUMERIC DEFAULT 0,
      nature_of_delay TEXT
    );
    `);

    // Add columns if they don't exist (for migration)
    const newCols = [
      "source_agency TEXT", "contractor_name TEXT", "lsb_resolution_no TEXT", "moa_ref_no TEXT", "moa_date DATE",
      "validity_period TEXT", "contract_duration TEXT", "date_approved_pow DATE", "approved_contract_budget NUMERIC",
      "schedule_of_fund_release TEXT", "number_of_tranches INTEGER", "amount_per_tranche NUMERIC",
      "mode_of_procurement TEXT", "philgeps_ref_no TEXT", "pcab_license_no TEXT", "date_contract_signing DATE",
      "date_notice_of_award DATE", "bid_amount NUMERIC", "latitude TEXT", "longitude TEXT",
      "pow_pdf TEXT", "dupa_pdf TEXT", "contract_pdf TEXT",
      "project_status TEXT DEFAULT 'Not Yet Started'", "accomplishment_percentage NUMERIC DEFAULT 0",
      "status_as_of_date DATE", "amount_utilized NUMERIC DEFAULT 0", "nature_of_delay TEXT",
      "root_project_id INTEGER", "finance_id INTEGER"
    ];

    for (const col of newCols) {
      await pool.query(`ALTER TABLE lgu_projects ADD COLUMN IF NOT EXISTS ${col}; `);
    }

    // --- MIGRATION: Backfill root_project_id for existing records ---
    // If root_project_id is NULL, set it to the project's own ID (it becomes the root)
    await pool.query(`
        UPDATE lgu_projects 
        SET root_project_id = lgu_project_id 
        WHERE root_project_id IS NULL;
    `);
    console.log("✅ DB Init: LGU Projects table verified (Updated Schema + History Support).");

  } catch (err) {
    console.error("❌ Finance DB Init Error:", err);
  }

};
// initFinanceDB(); // Moved to awaited startup

// --- PSIP DATABASE INIT ---
const initMasterlistDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS masterlist_26_30 (
          "Index" integer PRIMARY KEY,
          "congressman" character varying(255),
          "governor" character varying(255),
          "mayor" character varying(255),
          "region" character varying(100),
          "division" character varying(100),
          "school_id" character varying(50),
          "lis_nsbi_school_id_24_25" character varying(50),
          "in_masterlist_with_gov" character varying(50),
          "school_name" text,
          "municipality" character varying(100),
          "legislative_district" character varying(100),
          "priority_index" numeric,
          "cl_requirement" integer,
          "est_classroom_shortage" integer,
          "no_of_sites" integer,
          "proposed_no_of_cl" integer,
          "no_of_unit" integer,
          "sty_count" integer,
          "cl_count" integer,
          "proposed_scope_of_work" text,
          "number_of_workshops" text,
          "workshop_types" text,
          "other_design_configurations" text,
          "proposed_funding_year" integer,
          "est_classroom_cost" numeric,
          "project_implementor" character varying(255),
          "cl_sty_ratio" character varying(50)
      );
    `);
    // Migration: Rename leg_district to legislative_district if it exists
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'masterlist_26_30' AND column_name = 'leg_district') THEN
          ALTER TABLE masterlist_26_30 RENAME COLUMN leg_district TO legislative_district;
        END IF;
      END $$;
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_masterlist_region ON masterlist_26_30("region");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_masterlist_funding_year ON masterlist_26_30("proposed_funding_year");`);
    console.log("✅ DB Init: Masterlist (Cloned) table verified.");
  } catch (err) {
    console.error("❌ Masterlist DB Init Error:", err);
  }
};
// initMasterlistDB(); // Moved to awaited startup

// --- PSIP IMPORT ENDPOINT (One-Time) ---
/* app.get('/api/psip/import', async (req, res) => {
  const client = await pool.connect();
  try {
    // Check if already imported
    const countResult = await client.query('SELECT COUNT(*) FROM psip_masterlist');
    const existingCount = parseInt(countResult.rows[0].count);
    if (existingCount > 0) {
      return res.json({ message: `Already imported. ${existingCount} rows exist. Add ?force=true to re-import.`, count: existingCount });
    }

    // Dynamic import of xlsx
    const { createRequire: cr } = await import('module');
    const requireSync = cr(import.meta.url);
    const XLSX = requireSync('xlsx');

    // Find the file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, '..', 'public', 'Masterlist 2026-2030 139706 CL - with Cong-Gov-Mayor.xlsx');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Excel file not found at: ' + filePath });
    }

    console.log('📥 PSIP Import: Reading Excel file...');
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['MASTERLIST'];
    if (!ws) return res.status(400).json({ error: 'MASTERLIST sheet not found' });

    console.log('📥 PSIP Import: Converting to JSON...');
    const data = XLSX.utils.sheet_to_json(ws);
    console.log(`📥 PSIP Import: ${data.length} rows parsed.`);

    // Truncate if force
    if (req.query.force === 'true') {
      await client.query('TRUNCATE TABLE psip_masterlist RESTART IDENTITY');
      console.log('🗑️ PSIP Import: Table truncated (force mode).');
    }

    // Batch insert
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];

      batch.forEach((row, rIdx) => {
        const offset = rIdx * 14;
        values.push(
          row['CONGRESSMAN'] || null,
          row['GOVERNOR'] || null,
          row['MAYOR'] || null,
          row['Region'] || null,
          row['Division'] || null,
          row['School ID'] ? String(row['School ID']) : null,
          row['School Name'] || null,
          row['Municipality'] || null,
          row['Leg District'] || null,
          parseFloat(row['PRIORITY INDEX']) || null,
          parseInt(row['CL Requirement']) || 0,
          parseInt(row['Estimated Classroom Shortage']) || 0,
          parseInt(row['No. of Sites']) || 0,
          parseInt(row['Proposed No. of Classrooms']) || 0,
          parseInt(row['No. of Unit']) || 0,
          parseInt(row['STY']) || 0,
          parseInt(row['CL']) || 0,
          row['Proposed Scope Of Work'] || null,
          parseInt(row['Number of Workshops']) || 0,
          row['Workshop Type/s'] || null,
          parseInt(row['PROPOSED FUNDING YEAR']) || null,
          parseFloat(row['Est. Cost of Classrooms']) || 0,
          parseInt(row['CL/STY']) || 0
        );
        const p = Array.from({ length: 23 }, (_, k) => `$${offset + k + 1}`);
        // Fix: offset is based on 23 columns
        const realOffset = rIdx * 23;
        const realP = Array.from({ length: 23 }, (_, k) => `$${realOffset + k + 1}`);
        placeholders.push(`(${realP.join(',')})`);
      });

      // Rebuild values correctly
      const correctValues = [];
      batch.forEach((row) => {
        correctValues.push(
          row['CONGRESSMAN'] || null,
          row['GOVERNOR'] || null,
          row['MAYOR'] || null,
          row['Region'] || null,
          row['Division'] || null,
          row['School ID'] ? String(row['School ID']) : null,
          row['School Name'] || null,
          row['Municipality'] || null,
          row['Leg District'] || null,
          parseFloat(row['PRIORITY INDEX']) || null,
          parseInt(row['CL Requirement']) || 0,
          parseInt(row['Estimated Classroom Shortage']) || 0,
          parseInt(row['No. of Sites']) || 0,
          parseInt(row['Proposed No. of Classrooms']) || 0,
          parseInt(row['No. of Unit']) || 0,
          parseInt(row['STY']) || 0,
          parseInt(row['CL']) || 0,
          row['Proposed Scope Of Work'] || null,
          parseInt(row['Number of Workshops']) || 0,
          row['Workshop Type/s'] || null,
          parseInt(row['PROPOSED FUNDING YEAR']) || null,
          parseFloat(row['Est. Cost of Classrooms']) || 0,
          parseInt(row['CL/STY']) || 0
        );
      });

      const rebuildPlaceholders = [];
      batch.forEach((_, rIdx) => {
        const realOffset = rIdx * 23;
        const realP = Array.from({ length: 23 }, (_, k) => `$${realOffset + k + 1}`);
        rebuildPlaceholders.push(`(${realP.join(',')})`);
      });

      const query = `
        INSERT INTO psip_masterlist (
          congressman, governor, mayor, region, division, school_id, school_name,
          municipality, legislative_district, priority_index, cl_requirement, estimated_shortage,
          no_of_sites, proposed_classrooms, no_of_units, storeys, classrooms,
          scope_of_work, workshops, workshop_types, funding_year, estimated_cost, cl_per_storey
        ) VALUES ${rebuildPlaceholders.join(',')}
      `;

      await client.query(query, correctValues);
      inserted += batch.length;
      if (inserted % 5000 === 0 || inserted === data.length) {
        console.log(`📥 PSIP Import: ${inserted}/${data.length} rows inserted...`);
      }
    }

    console.log(`✅ PSIP Import Complete: ${inserted} rows inserted.`);
    res.json({ success: true, count: inserted });

  } catch (err) {
    console.error('❌ PSIP Import Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}); */

// --- MASTERLIST API ENDPOINTS ---

app.get('/api/debug-integrity', async (req, res) => {
  try {
    const client = await pool.connect();
    const results = {
      count: (await client.query('SELECT COUNT(*) FROM masterlist_26_30')).rows[0].count,
      shortage_sum: (await client.query('SELECT SUM(est_classroom_shortage) as val FROM masterlist_26_30')).rows[0].val,
      duplicates: (await client.query(`
                SELECT "school_id", "sty_count", "cl_count", "proposed_funding_year", COUNT(*)
                FROM masterlist_26_30
                GROUP BY "school_id", "sty_count", "cl_count", "proposed_funding_year"
                HAVING COUNT(*) > 1
                LIMIT 5
            `)).rows
    };
    client.release();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for dynamic WHERE clause
const buildMasterlistQuery = (baseQuery, filters) => {
  const { region, division, municipality, legislative_district } = filters;
  let where = [];
  let params = [];
  let pIdx = 1;

  if (region) { where.push(`"region" = $${pIdx++}`); params.push(region); }
  if (division) { where.push(`"division" = $${pIdx++}`); params.push(division); }
  if (municipality) { where.push(`"municipality" = $${pIdx++}`); params.push(municipality); }
  if (legislative_district) { where.push(`"legislative_district" = $${pIdx++}`); params.push(legislative_district); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return { query: `${baseQuery}${whereClause ? ' ' + whereClause : ''}`, params };
};

// Filter options (Cascading)
app.get('/api/masterlist/filters', async (req, res) => {
  try {
    const { region, division, municipality } = req.query;

    let query, params;
    if (municipality) {
      // Fetch Leg Districts for Municipality
      query = 'SELECT DISTINCT "legislative_district" FROM masterlist_26_30 WHERE "municipality" = $1 ORDER BY "legislative_district"';
      params = [municipality];
    } else if (division) {
      // Fetch Municipalities for Division
      query = 'SELECT DISTINCT "municipality" FROM masterlist_26_30 WHERE "division" = $1 ORDER BY "municipality"';
      params = [division];
    } else if (region) {
      // Fetch Divisions for Region
      query = 'SELECT DISTINCT "division" FROM masterlist_26_30 WHERE "region" = $1 ORDER BY "division"';
      params = [region];
    } else {
      // Fetch Regions
      query = 'SELECT DISTINCT "region" FROM masterlist_26_30 WHERE "region" IS NOT NULL ORDER BY "region"';
      params = [];
    }

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => Object.values(r)[0]));
  } catch (err) {
    console.error('❌ Masterlist Filters Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Summary totals
app.get('/api/masterlist/summary', async (req, res) => {
  try {
    const base = `
      SELECT
        COUNT(*) as total_projects,
        COUNT(DISTINCT "school_id") as total_schools,
        COALESCE(SUM("proposed_no_of_cl"), 0) as total_classrooms,
        COALESCE(SUM("est_classroom_cost"), 0) as total_cost,
        COALESCE(SUM("est_classroom_shortage"), 0) as total_shortage,
        COALESCE(SUM("no_of_sites"), 0) as total_sites,
        COUNT(DISTINCT "region") as total_regions,
        COUNT(DISTINCT "congressman") as total_congressmen,
        COUNT(DISTINCT "governor") as total_governors,
        COUNT(DISTINCT "mayor") as total_mayors
      FROM masterlist_26_30
    `;
    const { query, params } = buildMasterlistQuery(base, req.query);
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Masterlist Summary Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// By Region
app.get('/api/masterlist/by-region', async (req, res) => {
  try {
    const base = `
      SELECT
        "region" as region,
        COUNT(*) as projects,
        COUNT(DISTINCT "school_id") as schools,
        COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms,
        COALESCE(SUM("est_classroom_cost"), 0) as cost,
        COALESCE(SUM("est_classroom_shortage"), 0) as shortage
      FROM masterlist_26_30
    `;
    const { query, params } = buildMasterlistQuery(base, req.query);
    const finalQuery = `${query} ${query.includes('WHERE') ? 'AND' : 'WHERE'} "region" IS NOT NULL GROUP BY "region" ORDER BY classrooms DESC`;
    const result = await pool.query(finalQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Masterlist By Region Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// By Funding Year
app.get('/api/masterlist/by-funding-year', async (req, res) => {
  try {
    const base = `
      SELECT
        "proposed_funding_year" as funding_year,
        COUNT(*) as projects,
        COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms,
        COALESCE(SUM("est_classroom_cost"), 0) as cost
      FROM masterlist_26_30
    `;
    const { query, params } = buildMasterlistQuery(base, req.query);
    const finalQuery = `${query} ${query.includes('WHERE') ? 'AND' : 'WHERE'} "proposed_funding_year" IS NOT NULL GROUP BY "proposed_funding_year" ORDER BY "proposed_funding_year"`;
    const result = await pool.query(finalQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Masterlist By Year Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// By Storey Type
app.get('/api/masterlist/by-storey', async (req, res) => {
  try {
    const base = `
      SELECT
        "sty_count" as storeys,
        COUNT(*) as projects,
        COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms,
        COALESCE(SUM("est_classroom_cost"), 0) as cost
      FROM masterlist_26_30
    `;
    const { query, params } = buildMasterlistQuery(base, req.query);
    const finalQuery = `${query} ${query.includes('WHERE') ? 'AND' : 'WHERE'} "sty_count" > 0 GROUP BY "sty_count" ORDER BY "sty_count"`;
    const result = await pool.query(finalQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Masterlist By Storey Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Distribution Chart API (Dynamic Grouping Strategy)
app.get('/api/masterlist/distribution', async (req, res) => {
  try {
    const { groupBy, region, division, municipality, legislative_district } = req.query;

    // Validate groupBy to prevent SQL injection issues
    const validGroupBys = ['region', 'division', 'municipality', 'legislative_district'];
    const groupField = validGroupBys.includes(groupBy) ? groupBy : 'region';

    const base = `
      SELECT
        "${groupField}" as name,
        COUNT(*) as projects,
        COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms,
        COALESCE(SUM("est_classroom_cost"), 0) as cost,
        COUNT(DISTINCT "school_id") as schools,
        COALESCE(SUM("est_classroom_shortage"), 0) as shortage,
        COALESCE(SUM("no_of_sites"), 0) as sites
      FROM masterlist_26_30
    `;
    const { query, params } = buildMasterlistQuery(base, { region, division, municipality, legislative_district });

    // Need to exclude nulls from grouping
    const finalQuery = `${query} ${query.includes('WHERE') ? 'AND' : 'WHERE'} "${groupField}" IS NOT NULL GROUP BY "${groupField}" ORDER BY classrooms DESC`;

    const result = await pool.query(finalQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Masterlist Distribution Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// By Storey Breakdown (e.g., 2sty4cl)
app.get('/api/masterlist/storey-breakdown', async (req, res) => {
  try {
    const base = `
      SELECT
        "sty_count" as storey,
        "cl_count" as classrooms,
        COUNT(*) as count
      FROM masterlist_26_30
    `;
    const { query, params } = buildMasterlistQuery(base, req.query);
    const finalQuery = `${query} ${query.includes('WHERE') ? 'AND' : 'WHERE'} "sty_count" IS NOT NULL AND "cl_count" IS NOT NULL GROUP BY "sty_count", "cl_count" ORDER BY "sty_count", "cl_count"`;
    const result = await pool.query(finalQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Masterlist Storey Breakdown Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get schools for a specific storey breakdown (prototype)
app.get('/api/masterlist/prototype-schools', async (req, res) => {
  try {
    const { sty, cl, region, division, municipality, legislative_district } = req.query;

    let baseWhere = [`"sty_count" = $1`, `"cl_count" = $2`];
    let pIdx = 3;
    let params = [Number(sty), Number(cl)];

    if (region) { baseWhere.push(`"region" = $${pIdx++}`); params.push(region); }
    if (division) { baseWhere.push(`"division" = $${pIdx++}`); params.push(division); }
    if (municipality && municipality !== 'undefined') { baseWhere.push(`"municipality" = $${pIdx++}`); params.push(municipality); }
    if (legislative_district && legislative_district !== 'undefined') { baseWhere.push(`"legislative_district" = $${pIdx++}`); params.push(legislative_district); }

    const query = `
      SELECT 
        "school_id", 
        "school_name", 
        "proposed_no_of_cl" as classrooms, 
        "est_classroom_shortage" as shortage,
        "est_classroom_cost" as cost
      FROM masterlist_26_30 
      WHERE ${baseWhere.join(' AND ')}
      ORDER BY classrooms DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Masterlist Prototype Schools Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Partnerships (Congressman / Governor / Mayor)
app.get('/api/masterlist/partnerships', async (req, res) => {
  try {
    const { region, division, municipality, legislative_district } = req.query;
    const { query: whereBase, params } = buildMasterlistQuery('', req.query);
    const whereClause = whereBase.trim() ? `AND ${whereBase.replace('WHERE', '').trim()}` : '';

    const [pgoRes, mgoRes, cgoRes, dpwhRes, depedRes, csoRes, forDecisionRes] = await Promise.all([
      pool.query(`
        SELECT "governor" as name, COUNT(*) as projects, COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms
        FROM masterlist_26_30 WHERE prov_implemented = true ${whereClause}
        GROUP BY "governor" ORDER BY classrooms DESC LIMIT 20
      `, params),
      pool.query(`
        SELECT "mayor" as name, COUNT(*) as projects, COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms
        FROM masterlist_26_30 WHERE muni_implemented = true ${whereClause}
        GROUP BY "mayor" ORDER BY classrooms DESC LIMIT 20
      `, params),
      pool.query(`
        SELECT "mayor" as name, COUNT(*) as projects, COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms
        FROM masterlist_26_30 WHERE city_implemented = true ${whereClause}
        GROUP BY "mayor" ORDER BY classrooms DESC LIMIT 20
      `, params),
      pool.query(`
        SELECT 'DPWH' as name, COUNT(*) as projects, COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms
        FROM masterlist_26_30 WHERE dpwh_implemented = true ${whereClause}
      `, params),
      pool.query(`
        SELECT 'DepEd' as name, COUNT(*) as projects, COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms
        FROM masterlist_26_30 WHERE deped_implemented = true ${whereClause}
      `, params),
      pool.query(`
        SELECT 'CSO/NGO' as name, COUNT(*) as projects, COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms
        FROM masterlist_26_30 WHERE cso_ngo_implemented = true ${whereClause}
      `, params),
      pool.query(`
        SELECT 'Multiple Agencies' as name, COUNT(*) as projects, COALESCE(SUM("proposed_no_of_cl"), 0) as classrooms
        FROM masterlist_26_30 
        WHERE (
          COALESCE(prov_implemented::int, 0) + 
          COALESCE(muni_implemented::int, 0) + 
          COALESCE(city_implemented::int, 0) + 
          COALESCE(dpwh_implemented::int, 0) + 
          COALESCE(deped_implemented::int, 0) + 
          COALESCE(cso_ngo_implemented::int, 0)
        ) > 1 AND (resolved_partnership IS NULL OR resolved_partnership = '') ${whereClause}
      `, params)
    ]);

    // Format single-row results (DPWH, DepEd, CSO, For Decision)
    const formatSingle = (resArr) => {
      const row = resArr.rows[0];
      return row && Number(row.projects) > 0 ? [row] : [];
    };

    res.json({
      totals: {
        governor_count: pgoRes.rows.length,
        mayor_count: mgoRes.rows.length + cgoRes.rows.length
      },
      pgo: pgoRes.rows,
      mgo: mgoRes.rows,
      cgo: cgoRes.rows,
      dpwh: formatSingle(dpwhRes),
      deped: formatSingle(depedRes),
      cso: formatSingle(csoRes),
      forDecision: formatSingle(forDecisionRes)
    });
  } catch (err) {
    console.error('❌ Masterlist Partnerships Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Resolve a partnership overlap
app.post('/api/masterlist/resolve-partnership', async (req, res) => {
  try {
    const { school_id, resolved_partnership } = req.body;
    if (!school_id) return res.status(400).json({ error: 'school_id is required' });

    await pool.query(
      `UPDATE masterlist_26_30 SET resolved_partnership = $1 WHERE school_id = $2`,
      [resolved_partnership || null, school_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Resolve Partnership Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get schools for a specific partnership
app.get('/api/masterlist/partnership-schools', async (req, res) => {
  try {
    const { type, name, region, division, municipality, legislative_district } = req.query;

    let baseWhere = [];
    if (type === 'PGO') baseWhere.push(`"governor" = $1`);
    else if (type === 'MGO') baseWhere.push(`"mayor" = $1 AND "municipality" NOT ILIKE '%City%'`);
    else if (type === 'CGO') baseWhere.push(`"mayor" = $1 AND "municipality" ILIKE '%City%'`);
    else if (type === 'DPWH') baseWhere.push(`dpwh_implemented = true`);
    else if (type === 'DEPED') baseWhere.push(`deped_implemented = true`);
    else if (type === 'CSO') baseWhere.push(`cso_ngo_implemented = true`);
    else if (type === 'FOR_DECISION') baseWhere.push(`(
        COALESCE(prov_implemented::int, 0) + 
        COALESCE(muni_implemented::int, 0) + 
        COALESCE(city_implemented::int, 0) + 
        COALESCE(dpwh_implemented::int, 0) + 
        COALESCE(deped_implemented::int, 0) + 
        COALESCE(cso_ngo_implemented::int, 0)
      ) > 1 AND (resolved_partnership IS NULL OR resolved_partnership = '')`);
    else return res.json([]);

    let pIdx = 1;
    let params = [];

    // Add name param ONLY for the governor/mayor queries that use $1
    if (['PGO', 'MGO', 'CGO'].includes(type)) {
      params.push(name);
      pIdx = 2;
    }

    if (region) { baseWhere.push(`"region" = $${pIdx++}`); params.push(region); }
    if (division) { baseWhere.push(`"division" = $${pIdx++}`); params.push(division); }
    if (municipality && municipality !== 'undefined') { baseWhere.push(`"municipality" = $${pIdx++}`); params.push(municipality); }
    if (legislative_district && legislative_district !== 'undefined') { baseWhere.push(`"legislative_district" = $${pIdx++}`); params.push(legislative_district); }

    const query = `
      SELECT 
        "school_id", 
        "school_name", 
        "proposed_no_of_cl" as classrooms, 
        "est_classroom_shortage" as shortage,
        "est_classroom_cost" as cost
      FROM masterlist_26_30 
      WHERE ${baseWhere.join(' AND ')}
      ORDER BY classrooms DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Masterlist Partnership Schools Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- AI CHATBOT INTEGRATION ---

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/api/masterlist/ai-query', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  try {
    const context = `
      You are a SQL expert for a PostgreSQL database. 
      The table name is "masterlist_26_30".
      Columns:
      - school_id (text)
      - school_name (text)
      - region (text)
      - division (text)
      - municipality (text)
      - legislative_district (text)
      - proposed_no_of_cl (numeric)
      - est_classroom_cost (numeric)
      - est_classroom_shortage (numeric)
      - sty (numeric, storeys)
      - cl (numeric, classrooms per building)
      - proposed_funding_year (numeric)
      - congressman (text)
      - governor (text)
      - mayor (text)

      Task: Translate the following user request into a single PostgreSQL SELECT query.
      Return ONLY THE RAW SQL query. NO MARKDOWN, NO EXPLANATION, NO BACKTICKS.
      The query MUST be read-only (SELECT only).
      Example: SELECT school_name, est_classroom_shortage FROM masterlist_26_30 WHERE region = 'REGION I' ORDER BY est_classroom_shortage DESC LIMIT 10;
      
      User Request: "${prompt}"
    `;

    const result = await aiModel.generateContent(context);
    const sql = result.response.text().trim().replace(/```sql|```/g, '').trim();

    console.log('🤖 AI Generated SQL:', sql);

    // Security check: Only allow SELECT, block destructive commands
    const upperSql = sql.toUpperCase();
    const isSafe = upperSql.startsWith('SELECT') &&
      !upperSql.includes('DROP') &&
      !upperSql.includes('DELETE') &&
      !upperSql.includes('UPDATE') &&
      !upperSql.includes('INSERT') &&
      !upperSql.includes('TRUNCATE') &&
      !upperSql.includes('ALTER');

    if (!isSafe) {
      return res.status(400).json({ error: "Only safe SELECT queries are allowed." });
    }

    // Execute query
    const dbResult = await pool.query(sql);
    res.json({ sql, data: dbResult.rows });

  } catch (err) {
    console.error('❌ AI Query Error:', err);
    res.status(500).json({ error: "AI could not process your request: " + err.message });
  }
});

// --- NEW VALIDATION ENDPOINTS ---

// 1. Fetch ALL Schools for Offline Caching
// 1. Fetch ALL Schools for Offline Caching
app.get('/api/offline/schools', async (req, res) => {
  try {
    // Fetch only necessary fields to keep payload light
    // CHANGED: Use 'schools' table instead of 'school_profiles'
    const query = `
            SELECT school_id, school_name, region, division, latitude, longitude 
            FROM schools 
            WHERE school_id IS NOT NULL
        `;
    const result = await pool.query(query);

    console.log(`✅ Fetched ${result.rows.length} schools for offline cache from 'schools' table.`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch schools for cache:", err);
    res.status(500).json({ error: "Failed to fetch schools" });
  }
});

// 2. Fetch Single School Profile (Online Validation)
app.get('/api/school-profile/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    // CHANGED: Use 'schools' table instead of 'school_profiles'
    console.log(`🔎 Searching for School ID: ${schoolId} in 'schools' table...`);
    const query = `SELECT * FROM schools WHERE school_id = $1`;
    const result = await pool.query(query, [schoolId]);

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: "School not found" });
    }
  } catch (err) {
    console.error("❌ Failed to fetch school profile:", err);
    res.status(500).json({ error: "Database error" });
  }
});

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
      (sp.res_armchair_func || 0) > 0 || (sp.res_armchairs_good || 0) > 0 ||
      (sp.res_toilets_male || 0) > 0 ||
      (sp.female_bowls_func || 0) > 0 || (sp.male_bowls_func || 0) > 0 ||
      (sp.male_urinals_func || 0) > 0 || (sp.pwd_bowls_func || 0) > 0);
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
      try {
        await calculateSchoolProgress(sp.school_id, pool); // Force trigger the main function
      } catch (e) {
        console.error("Auto-heal calc error:", e.message);
      }
    }

    res.json(report);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- DEBUG: SEED SCHOOLS (For Production Fix) ---
app.get('/api/debug/seed-schools', async (req, res) => {
  console.log("🌱 Seeding Schools initiated...");
  const client = await pool.connect();

  try {
    // 1. Fetch CSV from Public URL (Self-hosted)
    const protocol = req.protocol;
    const host = req.get('host');
    const csvUrl = `${protocol}://${host}/schools.csv`;
    console.log(`📥 Fetching CSV from: ${csvUrl}`);

    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);

    const csvText = await response.text();

    // 2. Parse CSV (Manual Parsing for simplicity without filesystem stream if fetch returns text)
    // Or use csv-parser with a readable stream from string
    const results = [];
    const Readable = require('stream').Readable;
    const s = new Readable();
    s.push(csvText);
    s.push(null); // end of stream

    await new Promise((resolve, reject) => {
      s.pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`📊 Parsed ${results.length} schools.`);

    if (results.length === 0) return res.json({ message: "CSV is empty" });

    // 3. Insert Data
    // Create table if not exists
    await client.query(`
            CREATE TABLE IF NOT EXISTS schools (
                school_id TEXT PRIMARY KEY,
                school_name TEXT,
                region TEXT,
                division TEXT,
                legislative_district TEXT,
                province TEXT,
                municipality TEXT,
                barangay TEXT,
                latitude TEXT,
                longitude TEXT,
                sub_office TEXT,
                school_type TEXT,
                school_abbreviation TEXT
            );
        `);

    // Batch Insert
    const BATCH_SIZE = 1000;
    let inserted = 0;

    // We use ON CONFLICT DO NOTHING to avoid errors on duplicates
    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];

      batch.forEach((row, idx) => {
        // Map CSV headers to columns (assuming CSV headers match or we map them)
        // Use sanitize logic if needed, but assuming CSV keys match for now or just generic mapping
        // Let's use specific columns to be safe based on import_schools.js
        // import_schools uses dynamic headers.
        // We'll trust the CSV keys match DB columns for now or just map known ones.
        // Actually, let's just log headers first if we can?
        // results[0] keys are headers.
      });

      // Re-use logic from import script (Dynamic Columns)
      if (batch.length === 0) continue;
      const headers = Object.keys(batch[0]);

      // Construct query
      const batchValues = [];
      batch.forEach((row, rIdx) => {
        const rowVals = Object.values(row);
        rowVals.forEach(v => batchValues.push(v));

        const rowPlaceholders = rowVals.map((_, cIdx) => `$${(rIdx * headers.length) + cIdx + 1}`);
        placeholders.push(`(${rowPlaceholders.join(',')})`);
      });

      const query = `
                INSERT INTO schools (${headers.map(h => h.replace(/[^a-z0-9_]/gi, '_').toLowerCase()).join(',')})
                VALUES ${placeholders.join(',')}
                ON CONFLICT (school_id) DO UPDATE SET 
                    school_name = EXCLUDED.school_name,
                    region = EXCLUDED.region,
                    division = EXCLUDED.division,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude
            `;

      // Note: Postgres params limit is 65535. 1000 rows * 13 cols = 13000. Safe.
      await client.query(query, batchValues);
      inserted += batch.length;
      console.log(`... Inserted/Updated ${inserted} rows`);
    }

    res.json({ success: true, count: results.length, inserted });

  } catch (err) {
    console.error("Seed Error:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    client.release();
  }
});

// --- VALIDATE SCHOOL HEALTH ---
app.post('/api/validate-school-health', async (req, res) => {
  const { school_id } = req.body;
  if (!school_id) {
    return res.status(400).json({ error: 'Missing school_id' });
  }

  console.log(`Running Fraud Detection for School: ${school_id}...`);

  // Assuming the python script is in the parent directory or specific path
  // Adjust path as needed. Based on file system, it's in the root of the project.
  // api/index.js is in api/ folder, so script is ../advanced_fraud_detection.py
  // But usually running from root context?
  // Let's assume standard execution from project root if possible, or use absolute path.
  // The user runs `npm run dev:full` from `c:\Users\user\OneDrive - Department of Education\001 DepEd Seb\InsightED\InsightEd-Mobile-PWA`

  const scriptPath = path.join(path.resolve(), 'advanced_fraud_detection.py');
  const command = `python "${scriptPath}" --school_id "${school_id}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: 'Validation failed', details: stderr || error.message });
    }

    // Log stdout/stderr but don't fail if just warnings
    console.log(`Validator Output: ${stdout}`);
    if (stderr) console.warn(`Validator Warnings/Errors: ${stderr}`);

    res.json({ success: true, message: 'Validation completed successfully.', output: stdout });
  });
});

// --- HELPER: Auto-Fill Teachers from Master List ---
const autoFillSchoolTeachers = async (schoolId) => {
  try {
    console.log(`🤖 [Auto-Fill] Filling Teachers for School: ${schoolId}...`);

    // 1. Get the newly generated IERN from school_profiles
    const schoolRes = await pool.query("SELECT iern FROM school_profiles WHERE school_id = $1", [schoolId]);
    const schoolIern = schoolRes.rows.length > 0 ? schoolRes.rows[0].iern : null;

    if (!schoolIern) {
      console.warn(`⚠️ [Auto-Fill] No IERN found for school ${schoolId}. Proceeding with NULL IERN.`);
    }

    // 2. Insert from teachers_list using correct columns
    const res = await pool.query(`
        INSERT INTO teacher_specialization_details (
            iern, control_num, school_id, full_name, position, position_group, 
            specialization, teaching_load, created_at, updated_at
        )
        SELECT 
            $2, 
            "control_num", 
            "school.id", 
            TRIM(CONCAT("first", ' ', "middle", ' ', "last")), 
            "position", 
            "position_group", 
            "specialization.final", 
            0, 
            NOW(), 
            NOW()
        FROM teachers_list 
        WHERE "school.id" = $1
        ON CONFLICT (control_num) DO NOTHING
    `, [schoolId, schoolIern]);

    console.log(`✅ [Auto-Fill] Success! Copied ${res.rowCount} teachers for school ${schoolId}.`);

  } catch (err) {
    console.error("❌ Auto-Fill Teachers Failed:", err.message);
  }
};

// --- TEACHER PERSONNEL ENDPOINTS ---

// GET: Fetch Teachers by School ID
app.get('/api/teacher-personnel/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM teacher_specialization_details WHERE school_id = $1 ORDER BY full_name`,
      [schoolId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching teachers:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
});

// POST: Save (Upsert/Delete) Teacher Personnel
app.post('/api/save-teacher-personnel', async (req, res) => {
  const { schoolId, teachers } = req.body; // teachers is an array of objects

  if (!schoolId || !Array.isArray(teachers)) {
    return res.status(400).json({ error: "Invalid payload. 'schoolId' and 'teachers' array are required." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get List of Incoming Control Numbers (to identify deletions)
    const incomingControlNums = teachers.map(t => t.control_num).filter(Boolean);

    // 2. DELETE: Remove teachers for this school that are NOT in the incoming list
    if (incomingControlNums.length > 0) {
      await client.query(
        `DELETE FROM teacher_specialization_details 
                 WHERE school_id = $1 AND control_num NOT IN(${incomingControlNums.map((_, i) => `$${i + 2}`).join(',')})`,
        [schoolId, ...incomingControlNums]
      );
    } else {
      // If incoming list is empty, delete ALL teachers for this school (User cleared the list)
      await client.query(`DELETE FROM teacher_specialization_details WHERE school_id = $1`, [schoolId]);
    }

    // 3. UPSERT: Insert or Update each teacher
    for (const t of teachers) {
      await client.query(`
                INSERT INTO teacher_specialization_details(
    iern, control_num, school_id, full_name, position, position_group,
    specialization, teaching_load, updated_at
  ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT(control_num) 
                DO UPDATE SET
specialization = EXCLUDED.specialization,
  teaching_load = EXCLUDED.teaching_load,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();
`, [
        t.iern,
        t.control_num,
        schoolId, // Ensure we use the schools ID from the payload or session context
        t.full_name,
        t.position,
        t.position_group,
        t.specialization,
        t.teaching_load
      ]);
    }

    // 4. SYNC: Update school_profiles for frontend status compatibility
    // We update 'spec_general_teaching' with the total count of teachers, 
    // ensuring SchoolForms.jsx sees a value > 0 to mark the form as "Completed".
    await client.query(`
      UPDATE school_profiles 
      SET spec_general_teaching = (
        SELECT COUNT(*)::int FROM teacher_specialization_details WHERE school_id = $1
      )
      WHERE school_id = $1
    `, [schoolId]);

    // 5. UPDATE PROGRESS
    await calculateSchoolProgress(schoolId, client);

    await client.query('COMMIT');
    res.json({ success: true, message: "Teacher personnel saved successfully." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Save Teacher Personnel Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
});

// POST: Save Legacy Specialization Aggregates
app.post('/api/save-teacher-specialization-legacy', async (req, res) => {
  const { schoolId, data } = req.body; // data contains spec_english_major: 5, etc.

  if (!schoolId || !data) {
    return res.status(400).json({ error: "Invalid payload. 'schoolId' and 'data' object are required." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // List of legacy columns to update
    const fields = [
      'spec_general_teaching', 'spec_ece_teaching',
      'spec_english_major', 'spec_filipino_major', 'spec_math_major',
      'spec_science_major', 'spec_ap_major', 'spec_mapeh_major',
      'spec_esp_major', 'spec_tle_major', 'spec_bio_sci_major',
      'spec_phys_sci_major', 'spec_agri_fishery_major', 'spec_others_major'
    ];

    const updates = [];
    const values = [schoolId];

    // Build dynamic UPDATE query
    fields.forEach((field, index) => {
      // Use the value from data, default to 0
      updates.push(`${field} = $${index + 2}`);
      values.push(data[field] ? parseInt(data[field]) : 0);
    });

    const query = `UPDATE school_profiles SET ${updates.join(', ')} WHERE school_id = $1`;

    await client.query(query, values);

    // Trigger progress update just in case
    await calculateSchoolProgress(schoolId, client);

    await client.query('COMMIT');
    res.json({ success: true, message: "Legacy specialization data saved." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Save Legacy Spec Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
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
    res.json({ success: true, count });
  } catch (err) {
    console.error("Recalculate Error:", err);
    res.status(500).json({ error: err.message });
  }
});



// --- HELPER FUNCTION: Calculate School Progress ---
// MOVED UP HERE FOR VISIBILITY but normally defined below
// (Assuming it is defined later in the file, we just need to find where it spawns python)


// --- VERCEL CRON ENDPOINT (MOVED TO TOP) ---
// Support both /api/cron... (Local) and /cron... (Vercel)
app.get(['/api/cron/check-deadline', '/cron/check-deadline'], async (req, res) => {
  // 1. Security Check
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET} `) {
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

    console.log(`ðŸ“… Deadline: ${deadlineVal}, Days Left: ${diffDays} `);

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
              : `Submission is due in ${diffDays} day${diffDays > 1 ? 's' : ''} !Please finalize your forms.`
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
      console.log(`â„¹ï¸ Skipping: ${diffDays} days remaining(Not within 0 - 3 range).`);
      return res.json({ message: `Not within reminder window(0 - 3 days).Days: ${diffDays} ` });
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
            INSERT INTO user_device_tokens(uid, fcm_token, updated_at)
VALUES($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT(uid)
            DO UPDATE SET fcm_token = $2, updated_at = CURRENT_TIMESTAMP
  `, [uid, token]);

    // --- DUAL WRITE: SAVE DEVICE TOKEN ---
    if (poolNew) {
      poolNew.query(`
            INSERT INTO user_device_tokens(uid, fcm_token, updated_at)
VALUES($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT(uid)
            DO UPDATE SET fcm_token = $2, updated_at = CURRENT_TIMESTAMP
  `, [uid, token]).catch(e => console.error("Dual-Write Token Err:", e.message));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Save Token Error:", err);
    res.status(500).json({ error: "Failed to save token" });
  }
});

// --- FINANCE ENDPOINTS ---

// 1. Create Finance Project (and Sync to LGU)
app.post('/api/finance/projects', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let {
      region, division, district, legislative_district, municipality, // Added municipality
      school_id, school_name, project_name,
      total_funds, fund_released, date_of_release
    } = req.body;

    // Sanitize currency inputs (remove commas)
    const cleanCurrency = (val) => {
      if (!val) return null;
      if (typeof val === 'string') return parseFloat(val.replace(/,/g, ''));
      return val;
    };

    const sanitizedTotalFunds = cleanCurrency(total_funds);
    const sanitizedFundReleased = cleanCurrency(fund_released);

    // A. Insert into Finance Table
    const financeQuery = `
      INSERT INTO finance_projects
  (region, division, district, legislative_district, municipality, school_id, school_name, project_name, total_funds, fund_released, date_of_release)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING finance_id;
`;
    const financeRes = await client.query(financeQuery, [
      region, division, district, legislative_district, municipality,
      school_id, school_name, project_name,
      sanitizedTotalFunds, sanitizedFundReleased, date_of_release
    ]);
    const financeId = financeRes.rows[0].finance_id;

    // B. Duplicate to LGU Table (lgu_projects) - LINKED
    const lguQuery = `
      INSERT INTO lgu_projects
  (
    finance_id, municipality,
    region, division, district, legislative_district, school_id, school_name, project_name,
    total_funds, fund_released, date_of_release,
    project_status
  )
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Not Yet Started')
      RETURNING lgu_project_id;
`;

    await client.query(lguQuery, [
      financeId, municipality,
      region, division, district, legislative_district, school_id, school_name, project_name,
      sanitizedTotalFunds, sanitizedFundReleased, date_of_release
    ]);

    await client.query('COMMIT');
    res.json({ success: true, finance_id: financeId, message: "Project created and synced to LGU." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Finance Create Error:", err);
    res.status(500).json({ error: "Failed to create finance project: " + err.message });
  } finally {
    client.release();
  }
});

// 2. Get All Finance Projects
app.get('/api/finance/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM finance_projects ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("Get Finance Projects Error:", err);
    res.status(500).json({ error: "Failed to fetch finance projects." });
  }
});

// --- LGU FINANCE ENDPOINTS ---

// 1. Create LGU Project
app.post('/api/lgu/projects', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      region, division, district, legislative_district, municipality,
      school_id, school_name, project_name,
      total_funds, fund_released, date_of_release,

      // New Fields
      source_agency, contractor_name, lsb_resolution_no, moa_ref_no, moa_date,
      validity_period, contract_duration, date_approved_pow, approved_contract_budget,
      schedule_of_fund_release, number_of_tranches, amount_per_tranche,
      mode_of_procurement, philgeps_ref_no, pcab_license_no,
      date_contract_signing, date_notice_of_award, bid_amount,
      latitude, longitude,

      // Images (handled via separate upload usually, but if passed as base64 here we might need to handle it or just metadata)
      // For now, let's assume images are uploaded separately like Engineer module

      project_status, accomplishment_percentage, status_as_of_date, amount_utilized, nature_of_delay,
      created_by_uid // NEW: User ID
    } = req.body;

    // Helper to sanitize numeric/date fields
    const sanitize = (val) => (val === '' || val === null || val === undefined ? null : val);
    const cleanNumeric = (val) => {
      if (val === '' || val === null || val === undefined) return null;
      if (typeof val === 'string') return parseFloat(val.replace(/,/g, ''));
      return val;
    };

    const query = `
      INSERT INTO lgu_projects
  (
    region, division, district, legislative_district, municipality, school_id, school_name, project_name,
    total_funds, fund_released, date_of_release,
    source_agency, contractor_name, lsb_resolution_no, moa_ref_no, moa_date,
    validity_period, contract_duration, date_approved_pow, approved_contract_budget,
    schedule_of_fund_release, number_of_tranches, amount_per_tranche,
    mode_of_procurement, philgeps_ref_no, pcab_license_no,
    date_contract_signing, date_notice_of_award, bid_amount,
    latitude, longitude,
    project_status, accomplishment_percentage, status_as_of_date, amount_utilized, nature_of_delay,
    created_by_uid
  )
VALUES(
  $1, $2, $3, $4, $5, $6, $7, $8,
  $9, $10, $11,
  $12, $13, $14, $15, $16,
  $17, $18, $19, $20,
  $21, $22, $23,
  $24, $25, $26,
  $27, $28, $29,
  $30, $31,
  $32, $33, $34, $35, $36,
  $37
)
      RETURNING lgu_project_id;
`;

    const result = await client.query(query, [
      region, division, district, legislative_district, municipality, school_id, school_name, project_name,
      cleanNumeric(total_funds), cleanNumeric(fund_released), sanitize(date_of_release),
      source_agency, contractor_name, lsb_resolution_no, moa_ref_no, sanitize(moa_date),
      validity_period, contract_duration, sanitize(date_approved_pow), cleanNumeric(approved_contract_budget),
      schedule_of_fund_release, cleanNumeric(number_of_tranches), cleanNumeric(amount_per_tranche),
      mode_of_procurement, philgeps_ref_no, pcab_license_no,
      sanitize(date_contract_signing), sanitize(date_notice_of_award), cleanNumeric(bid_amount),
      latitude, longitude,
      project_status || 'Not Yet Started', cleanNumeric(accomplishment_percentage) || 0, sanitize(status_as_of_date), cleanNumeric(amount_utilized) || 0, nature_of_delay,
      created_by_uid
    ]);

    // --- FIX: Initialize root_project_id ---
    const newProjectId = result.rows[0].lgu_project_id;
    await client.query('UPDATE lgu_projects SET root_project_id = $1 WHERE lgu_project_id = $1', [newProjectId]);

    await client.query('COMMIT');
    res.json({ success: true, lgu_project_id: newProjectId, message: "LGU Project created." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("LGU Project Create Error:", err);
    res.status(500).json({ error: "Failed to create LGU project.", details: err.message });
  } finally {
    client.release();
  }
});

/* 
// DUPLICATE ROUTE REMOVED (Legacy) - See line 8574 for correct implementation
// 2. Get All LGU Projects (Filtered by User & Municipality)
app.get('/api/lgu/projects', async (req, res) => {
  const { uid } = req.query; // Get UID from query
  try {
    let query = 'SELECT * FROM lgu_projects';
    let params = [];
    let whereClauses = [];
 
    // Check User Role & Municipality
    if (uid) {
      const userRes = await pool.query('SELECT role, city FROM users WHERE uid = $1', [uid]);
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        // If user is LGU, filter by municipality (city)
        // Assuming role 'LGU' or checking if city is present
        if (user.city) {
          whereClauses.push(`municipality = $${ params.length + 1 } `);
          params.push(user.city);
        }
      }
      // Also allow filtering by creator if needed, but for now municipality is the main filter
      // whereClauses.push(`created_by_uid = $${ params.length + 1 } `);
      // params.push(uid);
    }
 
    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }
 
    query += ' ORDER BY created_at DESC';
 
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Get LGU Projects Error:", err);
    res.status(500).json({ error: "Failed to fetch LGU projects." });
  }
});
*/

// 3. Update LGU Project (Liquidation)
app.put('/api/lgu/projects/:id', async (req, res) => {
  const { id } = req.params;
  // Support both Liquidation AND Progress updates
  const {
    liquidated_amount, liquidation_date,
    project_status, accomplishment_percentage, status_as_of_date, amount_utilized, nature_of_delay
  } = req.body;

  try {
    // 1. Fetch current data
    const pRes = await pool.query('SELECT * FROM lgu_projects WHERE lgu_project_id = $1', [id]);
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    const current = pRes.rows[0];

    // 2. Prepare Updates
    let updates = [];
    let values = [];
    let idx = 1;

    // Liquidation Logic
    if (liquidated_amount !== undefined) {
      const totalFunds = parseFloat(current.total_funds || 0);
      let liq = 0;
      if (typeof liquidated_amount === 'string') {
        liq = parseFloat(liquidated_amount.replace(/,/g, ''));
      } else {
        liq = parseFloat(liquidated_amount || 0);
      }

      let pct = 0;
      if (totalFunds > 0) pct = parseFloat(((liq / totalFunds) * 100).toFixed(2));

      updates.push(`liquidated_amount = $${idx++} `); values.push(liq);
      updates.push(`percentage_liquidated = $${idx++} `); values.push(pct);

      if (liquidation_date) {
        updates.push(`liquidation_date = $${idx++} `); values.push(liquidation_date);
      }
    }

    // Progress Logic
    if (project_status !== undefined) { updates.push(`project_status = $${idx++} `); values.push(project_status); }
    if (accomplishment_percentage !== undefined) {
      let acc = accomplishment_percentage;
      if (typeof acc === 'string') acc = parseFloat(acc.replace(/,/g, ''));
      updates.push(`accomplishment_percentage = $${idx++} `); values.push(acc);
    }
    if (status_as_of_date !== undefined) { updates.push(`status_as_of_date = $${idx++} `); values.push(status_as_of_date); }
    if (amount_utilized !== undefined) {
      let util = amount_utilized;
      if (typeof util === 'string') util = parseFloat(util.replace(/,/g, ''));
      updates.push(`amount_utilized = $${idx++} `); values.push(util);
    }
    if (nature_of_delay !== undefined) { updates.push(`nature_of_delay = $${idx++} `); values.push(nature_of_delay); }

    if (updates.length === 0) {
      return res.json({ success: true, message: "No changes detected." });
    }

    values.push(id);
    const query = `
      UPDATE lgu_projects
      SET ${updates.join(', ')}
      WHERE lgu_project_id = $${idx}
RETURNING *;
`;
    const result = await pool.query(query, values);

    res.json({ success: true, project: result.rows[0] });

  } catch (err) {
    console.error("Update LGU Project Error:", err);
    res.status(500).json({ error: "Failed to update project." });
  }
});

// --- LGU LIQUIDATION ENDPOINTS (DEPRECATED/KEPT FOR REF IF NEEDED but we rely on new table now) ---

// 1. Update Liquidation (Old LGU Forms - keeping if needed for other modules but user wants NEW table)
// Leaving this here as it was part of existing code, but our new UI will use the new endpoints above.
app.put('/api/lgu/projects/:id/liquidation', async (req, res) => {
  const { id } = req.params; // project_id in lgu_forms
  const { liquidated_amount, liquidation_date, funds_downloaded } = req.body;

  try {
    // Calculate percentage
    // Ensure we have funds_downloaded. If not passed, fetch it.
    let totalFunds = funds_downloaded;

    if (!totalFunds) {
      const pRes = await pool.query('SELECT funds_downloaded FROM lgu_forms WHERE project_id = $1', [id]);
      if (pRes.rows.length > 0) {
        totalFunds = pRes.rows[0].funds_downloaded;
      }
    }

    let percentage = 0;
    if (totalFunds > 0 && liquidated_amount >= 0) {
      percentage = (liquidated_amount / totalFunds) * 100;
      percentage = parseFloat(percentage.toFixed(2)); // Round to 2 decimals
    }

    const query = `
      UPDATE lgu_forms
      SET liquidated_amount = $1, liquidation_date = $2, percentage_liquidated = $3
      WHERE project_id = $4
RETURNING *;
`;
    const result = await pool.query(query, [liquidated_amount, liquidation_date, percentage, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ success: true, project: result.rows[0] });

  } catch (err) {
    console.error("Update Liquidation Error:", err);
    res.status(500).json({ error: "Failed to update liquidation." });
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
            CREATE TABLE IF NOT EXISTS verification_codes(
  email VARCHAR(255) PRIMARY KEY,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP DEFAULT(NOW() + INTERVAL '10 minutes')
);
`);
    console.log("âœ… OTP Table Initialized");
  } catch (err) {
    console.error("âŒ Failed to init OTP table:", err);
  }
};

// --- DATABASE CONNECTION ---
// Auto-connect and initialize
const runLegacyMigrations = async () => {
  let client;
  try {
    client = await pool.connect();
    try {
      // Core remaining migrations
      await client.query(`CREATE TABLE IF NOT EXISTS notifications(id SERIAL PRIMARY KEY, recipient_uid TEXT NOT NULL, sender_uid TEXT, sender_name TEXT, title TEXT NOT NULL, message TEXT NOT NULL, type TEXT DEFAULT 'alert', is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
      await client.query(`ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS email TEXT;`);
      await client.query(`CREATE TABLE IF NOT EXISTS user_device_tokens(uid TEXT PRIMARY KEY, fcm_token TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
      await client.query(`ALTER TABLE lgu_projects ADD COLUMN IF NOT EXISTS created_by_uid TEXT;`);
      await client.query(`ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS curricular_offering TEXT;`);
      await client.query(`CREATE TABLE IF NOT EXISTS users(uid TEXT PRIMARY KEY, email TEXT, role TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, first_name TEXT, last_name TEXT, region TEXT, division TEXT, province TEXT, city TEXT, barangay TEXT, office TEXT, position TEXT, disabled BOOLEAN DEFAULT FALSE);`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT, ADD COLUMN IF NOT EXISTS last_name TEXT, ADD COLUMN IF NOT EXISTS region TEXT, ADD COLUMN IF NOT EXISTS division TEXT, ADD COLUMN IF NOT EXISTS province TEXT, ADD COLUMN IF NOT EXISTS city TEXT, ADD COLUMN IF NOT EXISTS barangay TEXT, ADD COLUMN IF NOT EXISTS office TEXT, ADD COLUMN IF NOT EXISTS position TEXT, ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;`);
      await client.query(`CREATE TABLE IF NOT EXISTS ecart_batches(id SERIAL PRIMARY KEY, school_id TEXT NOT NULL, batch_no VARCHAR(100), year_received INTEGER, source_fund VARCHAR(100), ecart_qty_laptops INTEGER DEFAULT 0, ecart_condition_laptops VARCHAR(50), ecart_has_smart_tv BOOLEAN DEFAULT false, ecart_tv_size VARCHAR(50), ecart_condition_tv VARCHAR(50), ecart_condition_charging VARCHAR(50), ecart_condition_cabinet VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
      await client.query(`CREATE TABLE IF NOT EXISTS system_settings(setting_key TEXT PRIMARY KEY, setting_value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_by TEXT);`);
    } catch (migErr) {
      console.error("Migration Error:", migErr.message);
    }
  } finally {
    if (client) client.release();
  }
};

// --- NEW DATABASE INITIALIZATION ---
/* Moved to awaited startup
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
*/

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

    const maskedEmail = `${maskedUsername} @${domain} `;
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

    let realEmail = profileRes.rows[0].email;
    if (!realEmail) {
      return res.status(400).json({ error: "No contact email found for this School ID." });
    }
    realEmail = realEmail.trim().replace(/\s/g, '');

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
      from: `"InsightEd Support" < ${process.env.EMAIL_USER}> `,
      to: realEmail,
      subject: 'InsightEd Password Reset',
      html: `
  < h3 > Password Reset Request</h3 >
                <p>We received a request to reset the password for School ID: <b>${schoolId}</b>.</p>
                <p>Click the link below to verify your email and invoke the reset logic:</p>
                <a href="${link}">Reset Password</a>
                <p>If you did not request this, please ignore this email.</p>
`
    };

    await transporter.sendMail(mailOptions);
    console.log(`âœ… Password reset email sent successfully to ${realEmail} `);
    res.json({ success: true, message: `Reset link sent to ${realEmail} ` });

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
      console.warn(`âš ï¸ Failed master password attempt for: ${email} `);
      return res.status(403).json({ error: "Invalid master password." });
    }

    // 2. Look up the target user by email (with Smart School ID Lookup)
    let targetEmail = email.trim();

    // If School ID provided (no @), use DB Lookup to find the real email
    if (!targetEmail.includes('@') && /^\d+$/.test(targetEmail)) {
      // Try USERS table first
      let lookupResult = await pool.query("SELECT email FROM users WHERE email LIKE $1 LIMIT 1", [`${targetEmail}@%`]);
      if (lookupResult.rows.length > 0) {
        targetEmail = lookupResult.rows[0].email;
      } else {
        // Fallback: SCHOOL_PROFILES table
        lookupResult = await pool.query("SELECT email FROM school_profiles WHERE school_id = $1 AND email IS NOT NULL LIMIT 1", [targetEmail]);
        if (lookupResult.rows.length > 0) {
          targetEmail = lookupResult.rows[0].email;
        } else {
          // Last resort: default to @deped.gov.ph
          targetEmail = `${targetEmail}@deped.gov.ph`;
        }
      }

      // Check Firebase for @insighted.app (Priority Override)
      try {
        const originalId = email.trim();
        const fbUser = await admin.auth().getUserByEmail(`${originalId}@insighted.app`);
        targetEmail = fbUser.email;
      } catch (fbErr) {
        // Ignore
      }

      console.log(`[Master Login] Resolved School ID to email: ${targetEmail} `);
    }

    // Query Firebase for user
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(targetEmail);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        return res.status(404).json({ error: `User not found in Firebase for email: ${targetEmail} ` });
      }
      throw authErr;
    }

    // 3. Get user's role and details from SQL (try users, then school_profiles)
    let userData;
    const userRes = await pool.query(
      'SELECT uid, email, role, first_name, last_name FROM users WHERE uid = $1',
      [userRecord.uid]
    );

    if (userRes.rows.length > 0) {
      userData = userRes.rows[0];
    } else {
      // Fallback 1: Legacy user only in school_profiles
      const spRes = await pool.query(
        'SELECT submitted_by as uid, email, school_name FROM school_profiles WHERE submitted_by = $1',
        [userRecord.uid]
      );
      if (spRes.rows.length > 0) {
        userData = {
          uid: spRes.rows[0].uid,
          email: spRes.rows[0].email,
          role: 'school_head',
          first_name: spRes.rows[0].school_name || 'School Head',
          last_name: ''
        };
      } else {
        // Fallback 2: Check Firestore (for Super Admin / Manual users not in SQL)
        try {
          const userDoc = await admin.firestore().collection('users').doc(userRecord.uid).get();
          if (userDoc.exists) {
            const firestoreData = userDoc.data();
            userData = {
              uid: userRecord.uid,
              email: userRecord.email,
              role: firestoreData.role || 'User',
              first_name: firestoreData.firstName || 'User',
              last_name: firestoreData.lastName || ''
            };
            console.log(`[Master Login] Recovered user from Firestore: ${targetEmail} (${userData.role})`);
          } else {
            return res.status(404).json({ error: "User exists in Auth but not in database (SQL or Firestore)." });
          }
        } catch (fsErr) {
          console.error("Firestore Fallback Error:", fsErr);
          return res.status(404).json({ error: "User exists in Auth but not in database." });
        }
      }
    }

    // 4. Generate Custom Token for the target user
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    // 5. Log the master password access
    await pool.query(`
      INSERT INTO activity_logs(user_uid, user_name, role, action_type, target_entity, details)
VALUES($1, $2, $3, $4, $5, $6)
    `, [
      userRecord.uid,
      `${userData.first_name || ''} ${userData.last_name || ''} `.trim() || 'Unknown',
      'MASTER_ACCESS',
      'MASTER_LOGIN',
      userData.email,
      `Account accessed via master password at ${new Date().toISOString()} `
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
      const fullName = `${first_name || ''} ${last_name || ''} `.trim();
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
const logActivity = async (userUid, userName, role, actionType, targetEntity, details, superUserContext = null) => {
  const query = `
        INSERT INTO activity_logs(user_uid, user_name, role, action_type, target_entity, details)
VALUES($1, $2, $3, $4, $5, $6)
  `;
  try {
    let dbDetails = details;
    if (superUserContext) {
      dbDetails = `[SUPER USER VIEW] ${details} (Context: ${superUserContext})`;
    }

    await pool.query(query, [userUid, userName, role, actionType, targetEntity, dbDetails]);
    console.log(`ðŸ“ Audit Logged: ${actionType} - ${targetEntity} `);

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

    console.log(`[InstantUpdate] Stats for ${schoolId}: Learners = ${totalEnrollment}, Teachers = ${totalTeachers}, Rooms = ${totalClassrooms} `);

    if (totalEnrollment > 0) {
      if (totalTeachers === 0) issues.push("Critical missing data. No teachers have been reported.");
      if (totalClassrooms === 0) issues.push("Critical missing data. No classrooms have been reported.");
      if (totalToilets === 0) issues.push("Critical missing data. No toilets have been reported.");
    }

    // 3. Score & Description
    // We default to 0 (Pending) instead of 100 to allow the Python script to run
    let score = 0;
    let description = "Pending Validation";
    let formsToRecheck = "";

    if (issues.length > 0) {
      score = 40; // Critical
      description = "Critical";
      formsToRecheck = issues.join("; ");
      console.log(`[InstantUpdate] Issues Found: ${formsToRecheck} `);
    } else {
      console.log(`[InstantUpdate] No Critical Issues. Awaiting Python Validation...`);
    }

    // 4. Update school_summary (Upsert)
    // We update the core metrics + data_health columns
    // NOTE: This query duplicates the Python fields to ensure instant sync.
    // Python script will later overwrite this with more advanced analysis (Outliers, etc.)
    const summaryQuery = `
      INSERT INTO school_summary(
    school_id, school_name, iern, region, division, district,
    total_learners, total_teachers, total_classrooms, total_toilets, total_seats,
    data_health_score, data_health_description, issues, last_updated
  ) VALUES(
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11,
    $12, $13, $14, CURRENT_TIMESTAMP
  )
      ON CONFLICT(school_id) DO UPDATE SET
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

    // Simple implementation: Insert with Pending/Critical score, but DO NOT overwrite existing score on conflict
    // unless there is a critical issue.
    // Python will refine and overwrite it later.
    await db.query(`
      INSERT INTO school_summary(
      school_id, school_name, iern, region, division, district,
      total_learners, total_teachers, total_classrooms, total_toilets, total_seats,
      data_health_score, data_health_description, issues, last_updated
    ) VALUES(
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, CURRENT_TIMESTAMP
    )
      ON CONFLICT(school_id) DO UPDATE SET
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
    // Criteria: At least one record in the new teacher_specialization_details table
    // OR legacy aggregate columns have data
    const resultSpec = await dbClientOrPool.query(
      'SELECT id FROM teacher_specialization_details WHERE school_id = $1 LIMIT 1',
      [schoolId]
    );

    let f6 = resultSpec.rows.length > 0 ? 1 : 0;

    if (!f6) {
      // Fallback: Check Legacy Columns
      // Columns: spec_general_teaching, spec_english_major, etc.
      // We check if ANY of them are greater than 0
      const legacyCols = [
        'spec_general_teaching', 'spec_ece_teaching', 'spec_english_major', 'spec_filipino_major',
        'spec_math_major', 'spec_science_major', 'spec_ap_major', 'spec_tle_major',
        'spec_mapeh_major', 'spec_esp_major', 'spec_bio_sci_major', 'spec_phys_sci_major',
        'spec_agri_fishery_major', 'spec_others_major'
      ];
      // Check if any col in sp is > 0
      const hasLegacy = legacyCols.some(col => (sp[col] || 0) > 0);
      if (hasLegacy) f6 = 1;
    }

    if (f6) completed++;

    // --- FORM 7: Resources ---
    // Criteria: Any key infrastructure/utility field is set OR any inventory count > 0
    const f7 = (sp.res_electricity_source || sp.res_water_source || sp.res_buildable_space || sp.sha_category ||
      (sp.res_armchair_func || 0) > 0 || (sp.res_armchairs_good || 0) > 0 ||
      (sp.res_toilets_male || 0) > 0 ||
      (sp.female_bowls_func || 0) > 0 || (sp.male_bowls_func || 0) > 0 ||
      (sp.male_urinals_func || 0) > 0 || (sp.pwd_bowls_func || 0) > 0) ? 1 : 0;
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
      // console.log(`[DEBUG] School ${ schoolId } F10 Incomplete.Keys checked: ${ Object.keys(sp).filter(k => k.startsWith('stat_')).length }, HasStats: ${ hasStats } `);
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

      try {
        const { spawn } = await import('child_process');
        // Pass schoolId as an argument with proper flag
        const pythonProcess = spawn('python', ['advanced_fraud_detection.py', '--school_id', schoolId]);

        pythonProcess.stdout.on('data', (data) => {
          // Optional: reduce log spam unless critical
          // console.log(`[Fraud Detection Output]: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
          console.error(`[Fraud Detection Error]: ${data}`);
        });

        pythonProcess.on('error', (err) => {
          console.error("❌ Failed to spawn python process:", err.message);
        });

        pythonProcess.on('close', (code) => {
          console.log(`âœ… Fraud Detection process completed with code ${code}`);
        });
      } catch (e) {
        console.error("❌ Error initializing fraud detection:", e.message);
      }
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
        province, municipality, district, legislative_district, barangay
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
// GET - Master List of Schools (For Converted/Transferred Schools)
// GET - Search Single School by ID (For Converted/Transferred Schools)
app.get('/api/master-list/school/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM schools WHERE school_id = $1', [id]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: "School not found" });
    }
  } catch (err) {
    console.error("Fetch Master School Error:", err);
    res.status(500).json({ error: "Failed to fetch school details" });
  }
});

// POST - Submit Converted School
app.post('/api/sdo/convert-school', async (req, res) => {
  const { school_id, ...newDetails } = req.body;
  console.log("Received convert-school request for ID:", school_id); // DEBUG LOG

  if (!school_id) {
    return res.status(400).json({ error: "School ID is required" });
  }

  try {
    // 1. Fetch Original Data
    console.log(`Querying original school data for ID: ${school_id}`); // DEBUG LOG
    const originalRes = await pool.query('SELECT * FROM schools WHERE school_id = $1', [school_id]);
    console.log(`Original school query found rows: ${originalRes.rows.length}`); // DEBUG LOG

    if (originalRes.rows.length === 0) {
      console.error(`Original school record not found for ID: ${school_id}`); // DEBUG LOG
      return res.status(404).json({ error: "Original school record not found" });
    }
    const originalData = originalRes.rows[0];

    // 2. Insert into converted_schools table
    // Ensure table exists (simple check/create if not exists for now)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS converted_schools (
        id SERIAL PRIMARY KEY,
        school_id VARCHAR(50) NOT NULL,
        original_data JSONB,
        new_data JSONB,
        submitted_by VARCHAR(100),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'Pending'
      )
    `);

    await pool.query(
      `INSERT INTO converted_schools (school_id, original_data, new_data, submitted_by, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        school_id,
        originalData,
        newDetails,
        newDetails.submitted_by,
        'Pending'
      ]
    );

    res.json({ message: "Converted school application submitted successfully" });
  } catch (err) {
    console.error("Convert School Error:", err);
    res.status(500).json({ error: "Failed to submit converted school application" });
  }
});

// GET - Master List of Schools (DEPRECATED)
app.get('/api/master-list/schools-deprecated', async (req, res) => {
  const { division, region } = req.query;

  if (!division) {
    return res.status(400).json({ error: "Division is required" });
  }

  try {
    // Fetch all schools in the division from the master 'schools' table
    // We select all columns to allow full autofill
    const query = `
      SELECT * 
      FROM schools 
      WHERE division = $1 
      ORDER BY school_name ASC
    `;

    // Optional: Filter by region if provided for extra safety, though division is usually unique enough
    // const query = `SELECT * FROM schools WHERE division = $1 AND region = $2 ORDER BY school_name ASC`;

    const result = await pool.query(query, [division]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Master Schools Error:", err);
    res.status(500).json({ error: "Failed to fetch master school list" });
  }
});

app.post('/api/sdo/submit-school', async (req, res) => {
  const {
    school_id,
    school_name,
    region,
    division,
    district,
    province,
    municipality,
    legislative_district,
    barangay,
    street_address,
    mother_school_id,
    curricular_offering,
    latitude,
    longitude,
    submitted_by,
    submitted_by_name,
    special_order
  } = req.body;

  // Validate required fields
  if (!school_id || !school_name || !region || !division || !submitted_by) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(`
      INSERT INTO pending_schools (
        school_id, school_name, region, division, district, province, municipality, legislative_district,
        barangay, street_address, mother_school_id, curricular_offering,
        latitude, longitude, submitted_by, submitted_by_name, special_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING pending_id
    `, [
      school_id, school_name, region, division, district, province, municipality, legislative_district,
      barangay, street_address, mother_school_id, curricular_offering,
      latitude, longitude, submitted_by, submitted_by_name, special_order
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

    const { region, division, province, municipality, district, legislative_district } = req.query;

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
        school_id, school_name, region, division, district, province, municipality, legislative_district,
        barangay, street_address, mother_school_id, curricular_offering, latitude, longitude, special_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (school_id) DO NOTHING
    `, [
      school.school_id, school.school_name, school.region, school.division, school.district,
      school.province, school.municipality, school.legislative_district, school.barangay,
      school.street_address, school.mother_school_id, school.curricular_offering,
      school.latitude, school.longitude, school.special_order
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
    if (user.role === 'Super User') console.log(`ðŸ¦¸ Super User Validated: ${uid}`);
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
      // --- JIT MIGRATION FOR @insighted.app USERS ---
      // If not found by UID, check if this is a new @insighted.app user
      // regarding an existing school.
      try {
        const userRecord = await admin.auth().getUser(uid);
        const email = userRecord.email;

        if (email && email.endsWith('@insighted.app')) {
          const schoolId = email.split('@')[0];

          // Check if school exists by ID
          const schoolRes = await pool.query('SELECT * FROM school_profiles WHERE school_id = $1', [schoolId]);

          if (schoolRes.rows.length > 0) {
            console.log(`[JIT Migration] Linking ${schoolId} to new UID: ${uid}`);

            // Update ownership
            await pool.query(
              'UPDATE school_profiles SET submitted_by = $1, email = $2 WHERE school_id = $3',
              [uid, email, schoolId]
            );

            // Return the school data (merged with summary query logic if needed)
            // For simplicity, just return the data we found (or re-query for full data)
            // Let's re-query to get the JOINed data
            const migratedResult = await pool.query(`
                SELECT 
                  sp.*,
                  ss.issues as data_quality_issues,
                  ss.data_health_score,
                  ss.data_health_description
                FROM school_profiles sp
                LEFT JOIN school_summary ss ON sp.school_id = ss.school_id
                WHERE sp.school_id = $1
              `, [schoolId]);

            if (migratedResult.rows.length > 0) {
              return res.json({ exists: true, data: migratedResult.rows[0] });
            }
          }
        }
      } catch (migrationErr) {
        console.warn("Migration check failed:", migrationErr);
      }

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

// --- 3a. GET: Get School Profile by ID (For Validation) ---
// --- 3. GET: Fetch All Schools (Lightweight for Offline Caching) ---
app.get('/api/offline/schools', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT school_id, school_name, region, division, latitude, longitude 
      FROM schools 
      WHERE school_id IS NOT NULL
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Offline Schools Error:", err);
    res.status(500).json({ error: "Failed to fetch schools for offline cache" });
  }
});

app.get('/api/school-profile/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query(`
      SELECT school_id, school_name, region, division, latitude, longitude 
      FROM schools 
      WHERE school_id = $1
    `, [schoolId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Fetch School Profile Error:", err);
    res.status(500).json({ error: "Failed to fetch school profile" });
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
      schoolData.legislative_district || schoolData.legislative,
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

    // --- AUTO-FILL TEACHERS (Helper) ---
    // Trigger auto-fill of teachers from master list
    await autoFillSchoolTeachers(schoolData.school_id);

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
    // 1. Try USERS table first (Modern Auth) - Prioritize @insighted.app
    let result = await pool.query(
      "SELECT email FROM users WHERE email ILIKE $1 ORDER BY (CASE WHEN email ILIKE '%@insighted.app' THEN 0 ELSE 1 END), email LIMIT 1",
      [`${schoolId}@%`]
    );

    if (result.rows.length > 0) {
      return res.json({ found: true, email: result.rows[0].email });
    }

    // 2. Fallback: Try SCHOOL_PROFILES table (Legacy)
    result = await pool.query(
      "SELECT email FROM school_profiles WHERE school_id = $1 AND email IS NOT NULL LIMIT 1",
      [schoolId]
    );

    // 3. Check Firebase Auth for @insighted.app specific account
    // This handles cases where the user is registered in Firebase but not yet synced to the USERS table
    try {
      const fbUser = await admin.auth().getUserByEmail(`${schoolId}@insighted.app`);
      return res.json({ found: true, email: fbUser.email });
    } catch (fbErr) {
      // Ignore user-not-found, proceed with DB result if any
    }

    if (result.rows.length > 0) {
      return res.json({ found: true, email: result.rows[0].email });
    }

    return res.json({ found: false });

  } catch (error) {
    console.error("Lookup Email Error:", error);
    res.status(500).json({ error: "Database error during lookup." });
  }
});

// --- 3g. GET: Lookup Masked Email by School ID (For Forgot Password) ---
app.get('/api/lookup-masked-email/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    let email = null;

    // 1. Try USERS table - Prioritize @insighted.app
    let result = await pool.query(
      "SELECT email FROM users WHERE email ILIKE $1 ORDER BY (CASE WHEN email ILIKE '%@insighted.app' THEN 0 ELSE 1 END), email LIMIT 1",
      [`${schoolId}@%`]
    );
    if (result.rows.length > 0) email = result.rows[0].email;

    // 2. Fallback: SCHOOL_PROFILES
    if (!email) {
      result = await pool.query(
        "SELECT email FROM school_profiles WHERE school_id = $1 AND email IS NOT NULL LIMIT 1",
        [schoolId]
      );
      if (result.rows.length > 0) email = result.rows[0].email;
    }

    // 3. Check Firebase Auth for @insighted.app specific account (Priority)
    try {
      const fbUser = await admin.auth().getUserByEmail(`${schoolId}@insighted.app`);
      email = fbUser.email;
    } catch (fbErr) {
      // Ignore user-not-found
    }

    if (email) {
      email = email.trim().replace(/\s/g, ''); // Fix malformed database emails with rogue spaces
      // Mask the email (e.g., 3*****5@deped.gov.ph)
      const parts = email.split('@');
      const name = parts[0];
      const domain = parts[1];

      // Simple masking logic: show first and last char of name
      let maskedName = name;
      if (name.length > 2) {
        maskedName = name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
      }

      return res.json({ found: true, maskedEmail: `${maskedName}@${domain}`, fullEmail: email }); // fullEmail needed for internal reset
    }

    return res.json({ found: false });

  } catch (error) {
    console.error("Lookup Masked Email Error:", error);
    res.status(500).json({ error: "Database error." });
  }
});



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

// --- Province lookup (for LGU Super User Selector) ---
app.get('/api/locations/provinces', async (req, res) => {
  const { region } = req.query;
  try {
    const result = await pool.query(
      "SELECT DISTINCT province FROM schools WHERE region = $1 AND province IS NOT NULL AND province != '' ORDER BY province ASC",
      [region]
    );
    res.json(result.rows.map(r => r.province));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Municipality by Province lookup (for LGU Super User Selector) ---
app.get('/api/locations/municipalities-by-province', async (req, res) => {
  const { region, province } = req.query;
  try {
    const result = await pool.query(
      "SELECT DISTINCT municipality FROM schools WHERE region = $1 AND province = $2 AND municipality IS NOT NULL AND municipality != '' ORDER BY municipality ASC",
      [region, province]
    );
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
        legDistrict: 'legislative_district',
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
    const query = `
      SELECT 
        p.*, 
        s.data_health_score, 
        s.data_health_description, 
        s.issues as data_quality_issues, 
        s.school_head_validation 
      FROM school_profiles p 
      LEFT JOIN school_summary s ON p.school_id = s.school_id 
      WHERE p.submitted_by = $1
    `;
    const result = await pool.query(query, [uid]);
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

  // GENERIC MODE HANDLE
  if (uid === '000000') {
    return res.json({
      exists: true,
      data: {
        school_id: "000000",
        school_name: "Generic High School (Preview)",
        division: "Preview Division",
        region: "Preview Region",
        total_enrollment: 0,
        forms_completed_count: 0,
        curricular_offering: "K-12"
      }
    });
  }

  try {
    const query = `
      SELECT 
        p.*, 
        s.data_health_score, 
        s.data_health_description, 
        s.issues as data_quality_issues, 
        s.school_head_validation 
      FROM school_profiles p 
      LEFT JOIN school_summary s ON p.school_id = s.school_id 
      WHERE p.submitted_by = $1
    `;
    const result = await pool.query(query, [uid]);
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

  if (uid === '000000') {
    return res.json({
      exists: true,
      data: {
        user_uid: "000000",
        name: "Super User (Preview)",
        position: "Principal I",
        contact_number: "09000000000",
        email: "superuser@deped.gov.ph"
      }
    });
  }

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
        legislative_district = $8,
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
      profileData.legislative_district || profileData.legDistrict,
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
      UPDATE school_summary
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
        INSERT INTO "engineer_image" (project_id, image_data, uploaded_by, category, ipc)
        VALUES ($1, $2, $3, $4, $5)
      `;

      for (const imgItem of data.images) {
        // Handle both string (legacy) and object formats
        const imgData = typeof imgItem === 'string' ? imgItem : imgItem.image_data;
        const category = typeof imgItem === 'object' ? imgItem.category : 'Internal';

        await client.query(imageQuery, [newProjectId, imgData, data.uid, category, newIpc]);
      }
    } else {
      // DEFAULT RECORD (Empty string for image_data to avoid NOT NULL issues)
      console.log("ℹ️ No images uploaded. Creating default tracking record.");
      const defaultImageQuery = `
            INSERT INTO "engineer_image" (project_id, image_data, uploaded_by, category, ipc)
            VALUES ($1, '', $2, 'Default', $3)
        `;
      await client.query(defaultImageQuery, [newProjectId, data.uid, newIpc]);
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
            INSERT INTO "engineer_image" (project_id, image_data, uploaded_by, category, ipc)
            VALUES ($1, $2, $3, $4, $5)
          `;
          for (const imgItem of data.images) {
            const imgData = typeof imgItem === 'string' ? imgItem : imgItem.image_data;
            const category = typeof imgItem === 'object' ? imgItem.category : 'Internal';
            await clientNew.query(imageQuery, [newProjIdSecondary, imgData, data.uid, category, newIpc]);
          }
        } else {
          // DEFAULT RECORD (Secondary - Empty string)
          const defaultImageQuery = `
                INSERT INTO "engineer_image" (project_id, image_data, uploaded_by, category, ipc)
                VALUES ($1, '', $2, 'Default', $3)
            `;
          await clientNew.query(defaultImageQuery, [newProjIdSecondary, data.uid, newIpc]);
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

    // Attempt secondary connection safely
    if (poolNew) {
      try {
        clientNew = await poolNew.connect();
        await clientNew.query('BEGIN');
      } catch (connErr) {
        console.error("⚠️ Dual-Write Conn Error (Update Project):", connErr.message);
        clientNew = null; // Continue with primary only
      }
    }

    await client.query('BEGIN');

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
            number_of_classrooms, number_of_storeys, number_of_sites, funds_utilized,
            pow_pdf, dupa_pdf, contract_pdf
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
        p.pow_pdf, p.dupa_pdf, p.contract_pdf,
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
        number_of_classrooms AS "numberOfClassrooms", number_of_storeys AS "numberOfStoreys",
        number_of_sites AS "numberOfSites", funds_utilized AS "fundsUtilized",
        pow_pdf, dupa_pdf, contract_pdf,
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
        number_of_classrooms AS "numberOfClassrooms", number_of_storeys AS "numberOfStoreys",
        number_of_sites AS "numberOfSites", funds_utilized AS "fundsUtilized",
        pow_pdf, dupa_pdf, contract_pdf,
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

// --- 11d. GET: Get Project History by IPC ---
app.get('/api/project-history/:ipc', async (req, res) => {
  const { ipc } = req.params;
  const isLgu = ipc?.startsWith('LGU-');

  try {
    const tableName = isLgu ? "lgu_projects" : "engineer_form";
    const nameColumn = isLgu ? "lgu_name" : "engineer_name";
    const idColumn = isLgu ? "lgu_project_id" : "project_id";
    const statusCol = isLgu ? "project_status" : "status";
    const statusAsOfCol = isLgu ? "status_as_of_date" : "status_as_of";

    const query = `
      SELECT 
        ${idColumn} AS "id", 
        other_remarks AS "remarks", 
        ${nameColumn} AS "engineerName", 
        ${statusCol} AS "status", 
        TO_CHAR(${statusAsOfCol}, 'YYYY-MM-DD') AS "statusAsOfDate",
        created_at
      FROM ${tableName}
      WHERE ipc = $1
      ORDER BY ${idColumn} DESC;
    `;
    const result = await pool.query(query, [ipc]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Project History Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- 20. POST: Upload Project Image (Base64) ---
app.post('/api/upload-image', async (req, res) => {
  const { projectId, imageData, uploadedBy, category } = req.body;
  if (!projectId || !imageData) return res.status(400).json({ error: "Missing required data" });

  try {
    // 1. Fetch IPC first
    const ipcRes = await pool.query('SELECT ipc FROM engineer_form WHERE project_id = $1', [projectId]);
    const ipc = ipcRes.rows.length > 0 ? ipcRes.rows[0].ipc : null;

    // 2. Resolve Latest Project ID (Fix for Updates)
    let finalProjectId = projectId;
    if (ipc) {
      const latestRes = await pool.query(
        'SELECT project_id FROM engineer_form WHERE ipc = $1 ORDER BY project_id DESC LIMIT 1',
        [ipc]
      );
      if (latestRes.rows.length > 0) {
        finalProjectId = latestRes.rows[0].project_id;
      }
    }

    // 3. Insert with Latest Project ID
    const query = `INSERT INTO engineer_image (project_id, image_data, uploaded_by, category, ipc) VALUES ($1, $2, $3, $4, $5) RETURNING id;`;
    const result = await pool.query(query, [finalProjectId, imageData, uploadedBy, category || 'Internal', ipc]);

    await logActivity(uploadedBy, 'Engineer', 'Engineer', 'UPLOAD', `Project ID: ${projectId}`, `Uploaded a new site image (${category || 'Internal'})`);
    res.status(201).json({ success: true, imageId: result.rows[0].id });

    // --- DUAL WRITE: UPLOAD IMAGE ---
    if (poolNew) {
      try {
        console.log("🔄 Dual-Write: Syncing Project Image...");
        if (ipc) {
          // Insert into Secondary using IPC for linking (Project ID might differ but IPC is constant)
          // We'll try to find the project_id on the secondary DB that has this IPC (latest one?)
          // Or just insert blindly if secondary table has IPC column?
          // Assuming secondary has same schema update applied via some mechanism (or we do it here if possible, but migrations run on start).

          // Ideally, we find the project_id on secondary that matches this IPC.
          const dwQuery = `
                INSERT INTO engineer_image (project_id, image_data, uploaded_by, category, ipc) 
                VALUES ((SELECT project_id FROM engineer_form WHERE ipc = $1 ORDER BY project_id DESC LIMIT 1), $2, $3, $4, $1);
            `;
          await poolNew.query(dwQuery, [ipc, imageData, uploadedBy, category || 'Internal']);
          console.log("✅ Dual-Write: Project Image Synced via IPC!");
        }
      } catch (dwErr) {
        console.error("❌ Dual-Write Error (Upload Image):", dwErr.message);
      }
    }
  } catch (err) {
    console.error("❌ Image Upload Error:", err.message);
    res.status(500).json({ error: "Failed to save image to database" });
  }
});

// --- 20b. POST: Upload Project Document (Sequential) ---
app.post('/api/upload-project-document', async (req, res) => {
  const { projectId, type, base64, uid } = req.body;
  if (!projectId || !type || !base64) return res.status(400).json({ error: "Missing required data" });

  let column = '';
  if (type === 'POW') column = 'pow_pdf';
  else if (type === 'DUPA') column = 'dupa_pdf';
  else if (type === 'CONTRACT') column = 'contract_pdf';
  else return res.status(400).json({ error: "Invalid document type" });

  try {
    const query = `UPDATE engineer_form SET ${column} = $1 WHERE project_id = $2`;
    await pool.query(query, [base64, projectId]);

    // Optional: Log activity
    // await logActivity(uid, 'Engineer', 'Engineer', 'UPLOAD', \`Project ID: \${projectId}\`, \`Uploaded \${type}\`);

    // --- DUAL WRITE ---
    if (poolNew) {
      try {
        // Get IPC to find project on secondary
        const ipcRes = await pool.query('SELECT ipc FROM engineer_form WHERE project_id = $1', [projectId]);
        if (ipcRes.rows.length > 0) {
          const ipc = ipcRes.rows[0].ipc;
          await poolNew.query(`UPDATE engineer_form SET ${column} = $1 WHERE ipc = $2`, [base64, ipc]);
          console.log(`✅ Dual-Write: ${type} Synced via IPC!`);
        }
      } catch (dwErr) {
        console.error("❌ Dual-Write Doc Upload Error:", dwErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Doc Upload Error:", err.message);
    res.status(500).json({ error: "Failed to save document" });
  }
});

// --- 21. GET: Fetch Project Images (Active) ---



app.get('/api/project-images/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    // Fetch via IPC column directly (much faster and cleaner)
    // We first need the IPC of the requested project

    const query = `
      SELECT id, uploaded_by, created_at, image_data, category, ipc 
      FROM engineer_image 
      WHERE ipc = (
          SELECT ipc FROM engineer_form WHERE project_id = $1
      ) 
      OR project_id = $1 -- Fallback for old images before migration if backfill missed anything (unlikely)
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [projectId]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching project images:", err.message);
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

// --- 21a. GET: Check Legacy Specialization Data ---
app.get('/api/check-legacy-specialization/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        spec_general_teaching, spec_ece_teaching, spec_english_major, spec_filipino_major,
        spec_math_major, spec_science_major, spec_ap_major, spec_tle_major,
        spec_mapeh_major, spec_esp_major, spec_bio_sci_major, spec_phys_sci_major,
        spec_agri_fishery_major, spec_others_major
       FROM school_profiles WHERE school_id = $1`,
      [schoolId]
    );

    if (result.rows.length === 0) {
      return res.json({ hasLegacyData: false });
    }

    const row = result.rows[0];
    const hasData = Object.values(row).some(val => (val || 0) > 0);

    res.json({ hasLegacyData: hasData });
  } catch (err) {
    console.error("Check Legacy Spec Error:", err);
    res.status(500).json({ error: "Failed to check legacy data" });
  }
});

// --- 21b. POST: Single Teacher Upsert (Fast Auto-Save) ---
app.post('/api/save-single-teacher', async (req, res) => {
  const { schoolId, teacher } = req.body;
  if (!schoolId || !teacher || !teacher.control_num) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // UPSERT Logic
    await client.query(`
      INSERT INTO teacher_specialization_details (
        control_num, school_id, full_name, position, position_group, 
        specialization, teaching_load, iern, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
      ON CONFLICT (control_num) 
      DO UPDATE SET 
        full_name = EXCLUDED.full_name,
        position = EXCLUDED.position,
        specialization = EXCLUDED.specialization,
        teaching_load = EXCLUDED.teaching_load,
        status = 'ACTIVE'
    `, [
      teacher.control_num,
      schoolId,
      teacher.full_name,
      teacher.position,
      teacher.position_group || 'TBD',
      teacher.specialization,
      teacher.teaching_load || 0,
      teacher.iern || null
    ]);

    await client.query('COMMIT');
    res.json({ success: true, message: "Teacher saved" });

    // Background: Update Progress (Fire and Forget)
    calculateSchoolProgress(schoolId, pool).catch(err => console.error("Background Progress Calc Error:", err));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Single Teacher Save Error:", err);
    res.status(500).json({ error: "Failed to save teacher" });
  } finally {
    client.release();
  }
});

// --- 21c. DELETE: Remove Teacher Personnel ---
app.delete('/api/delete-teacher-personnel/:schoolId/:controlNum', async (req, res) => {
  const { schoolId, controlNum } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM teacher_specialization_details WHERE school_id = $1 AND control_num = $2 RETURNING *',
      [schoolId, controlNum]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Teacher not found or already deleted" });
    }

    res.json({ success: true, message: "Teacher deleted successfully" });

    // Background: Update Progress
    calculateSchoolProgress(schoolId, pool).catch(err => console.error("Background Progress Calc Error:", err));

  } catch (err) {
    console.error("Delete Teacher Error:", err);
    res.status(500).json({ error: "Failed to delete teacher" });
  }
});

// --- 21b. GET: Fetch e-Cart Batches ---
app.get('/api/ecart-batches/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM ecart_batches WHERE school_id = $1 ORDER BY id ASC',
      [schoolId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch e-Cart Batches Error:', err);
    res.status(500).json({ error: 'Failed to fetch e-Cart batches' });
  }
});

// --- 22. POST: Save School Resources ---
app.post('/api/save-school-resources', async (req, res) => {
  const data = req.body;
  try {
    const query = `
            UPDATE school_profiles SET 
                res_water_source=$2, res_tvl_workshops=$3, res_electricity_source=$4, 
                res_buildable_space=$5, sha_category=$6,
                
                res_sci_labs=$7, res_com_labs=$8,
                
                res_ecart_func=$9, res_ecart_nonfunc=$10,
                res_laptop_func=$11, res_laptop_nonfunc=$12,
                res_tv_func=$13, res_tv_nonfunc=$14,
                res_printer_func=$15, res_printer_nonfunc=$16,
                res_desk_func=$17, res_desk_nonfunc=$18,
                res_armchair_func=$19, res_armchair_nonfunc=$20,
                res_handwash_func=$21, res_handwash_nonfunc=$22,
                
                seats_kinder=$23, seats_grade_1=$24, seats_grade_2=$25, seats_grade_3=$26,
                seats_grade_4=$27, seats_grade_5=$28, seats_grade_6=$29,
                seats_grade_7=$30, seats_grade_8=$31, seats_grade_9=$32, seats_grade_10=$33,
                seats_grade_11=$34, seats_grade_12=$35,

                has_buildable_space=$36::BOOLEAN,

                female_bowls_func=$37, female_bowls_nonfunc=$38,
                male_bowls_func=$39, male_bowls_nonfunc=$40,
                male_urinals_func=$41, male_urinals_nonfunc=$42,
                pwd_bowls_func=$43, pwd_bowls_nonfunc=$44,

                updated_at=CURRENT_TIMESTAMP
            WHERE school_id=$1
        `;

    const values = [
      data.schoolId,
      data.res_water_source, data.res_tvl_workshops, data.res_electricity_source,
      data.res_buildable_space, data.sha_category,

      data.res_sci_labs, data.res_com_labs,

      data.res_ecart_func || 0, data.res_ecart_nonfunc || 0,
      data.res_laptop_func || 0, data.res_laptop_nonfunc || 0,
      data.res_tv_func || 0, data.res_tv_nonfunc || 0,
      data.res_printer_func || 0, data.res_printer_nonfunc || 0,
      data.res_desk_func || 0, data.res_desk_nonfunc || 0,
      data.res_armchair_func || 0, data.res_armchair_nonfunc || 0,
      data.res_handwash_func || 0, data.res_handwash_nonfunc || 0,

      data.seats_kinder || 0, data.seats_grade_1 || 0, data.seats_grade_2 || 0, data.seats_grade_3 || 0,
      data.seats_grade_4 || 0, data.seats_grade_5 || 0, data.seats_grade_6 || 0,
      data.seats_grade_7 || 0, data.seats_grade_8 || 0, data.seats_grade_9 || 0, data.seats_grade_10 || 0,
      data.seats_grade_11 || 0, data.seats_grade_12 || 0,

      // $36
      data.res_buildable_space === 'Yes',

      // $37-$44: New sanitation fixture counts
      data.female_bowls_func || 0, data.female_bowls_nonfunc || 0,
      data.male_bowls_func || 0, data.male_bowls_nonfunc || 0,
      data.male_urinals_func || 0, data.male_urinals_nonfunc || 0,
      data.pwd_bowls_func || 0, data.pwd_bowls_nonfunc || 0
    ];

    await pool.query(query, values);

    // --- HANDLE BUILDABLE SPACES (Transactional) ---
    if (data.res_buildable_space === 'Yes' && data.spaces && Array.isArray(data.spaces)) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // 1. Delete existing for school
        await client.query('DELETE FROM buildable_spaces WHERE school_id = $1', [data.schoolId]);

        // 2. Insert new with stable space_number
        for (let i = 0; i < data.spaces.length; i++) {
          const space = data.spaces[i];
          await client.query(`
             INSERT INTO buildable_spaces (school_id, iern, space_number, latitude, longitude, length, width, total_area)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           `, [
            data.schoolId,
            data.iern || null,
            i + 1, // space_number: 1, 2, 3...
            space.lat, space.lng,
            space.length, space.width, space.area
          ]);
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        console.error("Buildable spaces transaction failed:", txErr);
      } finally {
        client.release();
      }
    } else if (data.res_buildable_space === 'No') {
      // Clear if No
      await pool.query('DELETE FROM buildable_spaces WHERE school_id = $1', [data.schoolId]);
    }

    // --- HANDLE E-CART BATCHES (Delete & Re-insert) ---
    if (data.ecartBatches && Array.isArray(data.ecartBatches) && data.ecartBatches.length > 0) {
      const ecClient = await pool.connect();
      try {
        await ecClient.query('BEGIN');
        await ecClient.query('DELETE FROM ecart_batches WHERE school_id = $1', [data.schoolId]);
        for (const b of data.ecartBatches) {
          await ecClient.query(`
            INSERT INTO ecart_batches (
              school_id, batch_no, year_received, source_fund,
              ecart_qty_laptops, ecart_condition_laptops,
              ecart_has_smart_tv, ecart_tv_size, ecart_condition_tv,
              ecart_condition_charging, ecart_condition_cabinet
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          `, [
            data.schoolId,
            b.batch_no || null,
            b.year_received ? parseInt(b.year_received) : null,
            b.source_fund || null,
            parseInt(b.ecart_qty_laptops) || 0,
            b.ecart_condition_laptops || null,
            b.ecart_has_smart_tv === true || b.ecart_has_smart_tv === 'true',
            b.ecart_tv_size || null,
            b.ecart_condition_tv || null,
            b.ecart_condition_charging || null,
            b.ecart_condition_cabinet || null
          ]);
        }
        await ecClient.query('COMMIT');
      } catch (ecErr) {
        await ecClient.query('ROLLBACK');
        console.error('e-Cart batches transaction failed:', ecErr);
      } finally {
        ecClient.release();
      }
    } else {
      // If array is empty or missing, clear existing rows
      await pool.query('DELETE FROM ecart_batches WHERE school_id = $1', [data.schoolId]);
    }

    res.json({ message: "Resources saved!" });

    // SNAPSHOT UPDATE (Primary)
    await calculateSchoolProgress(data.schoolId, pool);

    // --- DUAL WRITE: SCHOOL RESOURCES ---
    if (poolNew) {
      try {
        console.log("ðŸ”„ Dual-Write: Syncing School Resources...");
        await poolNew.query(query, values);

        // Sync Buildable Spaces
        if (data.res_buildable_space === 'Yes' && data.spaces) {
          await poolNew.query('DELETE FROM buildable_spaces WHERE school_id = $1', [data.schoolId]);
          for (let i = 0; i < data.spaces.length; i++) {
            const space = data.spaces[i];
            await poolNew.query(`
                INSERT INTO buildable_spaces (school_id, iern, space_number, latitude, longitude, length, width, total_area)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [data.schoolId, data.iern || null, i + 1, space.lat, space.lng, space.length, space.width, space.area]);
          }
        } else if (data.res_buildable_space === 'No') {
          await poolNew.query('DELETE FROM buildable_spaces WHERE school_id = $1', [data.schoolId]);
        }

        // Sync e-Cart Batches
        if (data.ecartBatches && Array.isArray(data.ecartBatches) && data.ecartBatches.length > 0) {
          await poolNew.query('DELETE FROM ecart_batches WHERE school_id = $1', [data.schoolId]);
          for (const b of data.ecartBatches) {
            await poolNew.query(`
              INSERT INTO ecart_batches (
                school_id, batch_no, year_received, source_fund,
                ecart_qty_laptops, ecart_condition_laptops,
                ecart_has_smart_tv, ecart_tv_size, ecart_condition_tv,
                ecart_condition_charging, ecart_condition_cabinet
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            `, [
              data.schoolId,
              b.batch_no || null,
              b.year_received ? parseInt(b.year_received) : null,
              b.source_fund || null,
              parseInt(b.ecart_qty_laptops) || 0,
              b.ecart_condition_laptops || null,
              b.ecart_has_smart_tv === true || b.ecart_has_smart_tv === 'true',
              b.ecart_tv_size || null,
              b.ecart_condition_tv || null,
              b.ecart_condition_charging || null,
              b.ecart_condition_cabinet || null
            ]);
          }
        } else {
          await poolNew.query('DELETE FROM ecart_batches WHERE school_id = $1', [data.schoolId]);
        }

        await calculateSchoolProgress(data.schoolId, poolNew);
        console.log("âœ… Dual-Write: School Resources Synced!");
      } catch (dwErr) {
        console.error("â Œ Dual-Write Error (School Resources):", dwErr.message);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- 22a. GET: Fetch Facility Repairs (Updated to use new itemized table) ---
app.get('/api/facility-repairs/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM facility_repair_details WHERE school_id = $1 OR iern = $1 ORDER BY building_no, room_no, id ASC',
      [schoolId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Facility Repairs Error:", err);
    res.status(500).json({ error: "Failed to fetch facility repairs" });
  }
});

// --- 22b. POST: Save Facility Repair (LEGACY - DISABLED, replaced by new itemized endpoint below) ---
// Old endpoint removed — was inserting into dropped `facility_repairs` table.
// New endpoint at bottom of file uses `facility_repair_details` table.

// --- 22c. GET: Fetch Facility Demolitions ---
app.get('/api/facility-demolitions/:iern', async (req, res) => {
  const { iern } = req.params;
  try {
    const result = await pool.query('SELECT * FROM facility_demolitions WHERE iern = $1 OR school_id = $1 ORDER BY created_at ASC', [iern]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Facility Demolitions Error:", err);
    res.status(500).json({ error: "Failed to fetch facility demolitions" });
  }
});

// --- 22d. POST: Save Facility Demolition (Single Item) ---
app.post('/api/save-facility-demolition', async (req, res) => {
  const d = req.body;
  try {
    // Sanitize booleans
    const toBool = (val) => val === true || val === 'true' || val === 1;

    const query = `
            INSERT INTO facility_demolitions (
                school_id, iern, building_no,
                reason_age, reason_safety, reason_calamity, reason_upgrade
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING demolition_id;
        `;

    const values = [
      d.schoolId || d.iern, // Fallback
      d.iern || d.schoolId,
      d.building_no,
      toBool(d.reason_age),
      toBool(d.reason_safety),
      toBool(d.reason_calamity),
      toBool(d.reason_upgrade)
    ];

    const result = await pool.query(query, values);
    res.json({ success: true, demolition_id: result.rows[0].demolition_id });

    // --- DUAL WRITE ---
    if (poolNew) {
      poolNew.query(query, values).catch(e => console.error("Dual-Write Demolition Error:", e));
    }

  } catch (err) {
    console.error("Save Demolition Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 22a. GET: Fetch Buildable Spaces ---
app.get('/api/buildable-spaces/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM buildable_spaces WHERE school_id = $1', [schoolId]);
    res.json(result.rows); // Returns array of spaces
  } catch (err) {
    console.error("Fetch Buildable Spaces Error:", err);
    res.status(500).json({ error: "Failed to fetch buildable spaces" });
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

// --- 24b. GET: Facility Inventory Data ---
app.get('/api/facility-inventory/:iern', async (req, res) => {
  const { iern } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM facility_inventory WHERE school_id = $1 OR iern = $1 ORDER BY id', [iern]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 25. POST: Save Physical Facilities (Unified Submission) ---
app.post('/api/save-physical-facilities', async (req, res) => {
  const data = req.body;
  const client = await pool.connect();
  const sanitize = (val) => (val === '' || val === null || val === undefined) ? 0 : val;
  const toBool = (val) => val === true || val === 'true' || val === 1;

  try {
    await client.query('BEGIN');

    // 1. Update Main Profile
    const queryProfile = `
            UPDATE school_profiles SET
                build_classrooms_total=$2, 
                build_classrooms_new=$3,
                build_classrooms_good=$4,
                build_classrooms_repair=$5,
                build_classrooms_demolition=$6,
                updated_at=CURRENT_TIMESTAMP
            WHERE school_id=$1
        `;

    await client.query(queryProfile, [
      data.schoolId,
      sanitize(data.build_classrooms_total),
      sanitize(data.build_classrooms_new),
      sanitize(data.build_classrooms_good),
      sanitize(data.build_classrooms_repair),
      sanitize(data.build_classrooms_demolition)
    ]);

    // 2. Handle Repairs (Delete All & Re-insert)
    // 2. Handle Repairs (Delete All & Re-insert)
    if (data.repairEntries && Array.isArray(data.repairEntries)) {
      await client.query('DELETE FROM facility_repair_details WHERE school_id = $1', [data.schoolId]);

      for (const r of data.repairEntries) {
        await client.query(`
                INSERT INTO facility_repair_details (
                    school_id, iern, building_no, room_no, item_name,
                    oms, condition, damage_ratio, recommended_action, demo_justification, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
          data.schoolId, data.iern || data.schoolId,
          r.building_no, r.room_no, r.item_name,
          r.oms || '', r.condition || '', r.damage_ratio || 0,
          r.recommended_action || '', r.demo_justification || '', r.remarks || ''
        ]);
      }
    }

    // 3. Handle Demolitions (Delete All & Re-insert)
    if (data.demolitionEntries && Array.isArray(data.demolitionEntries)) {
      await client.query('DELETE FROM facility_demolitions WHERE school_id = $1', [data.schoolId]);

      for (const d of data.demolitionEntries) {
        await client.query(`
                INSERT INTO facility_demolitions (
                    school_id, iern, building_no,
                    reason_age, reason_safety, reason_calamity, reason_upgrade
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
          data.schoolId, data.schoolId,
          d.building_no,
          toBool(d.reason_age), toBool(d.reason_safety),
          toBool(d.reason_calamity), toBool(d.reason_upgrade)
        ]);
      }
    }

    // 4. Handle Building Inventory (Delete All & Re-insert)
    if (data.inventoryEntries && Array.isArray(data.inventoryEntries)) {
      await client.query('DELETE FROM facility_inventory WHERE school_id = $1', [data.schoolId]);

      for (const inv of data.inventoryEntries) {
        await client.query(`
                INSERT INTO facility_inventory (
                    school_id, iern, building_name, category, status,
                    no_of_storeys, no_of_classrooms, year_completed, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
          data.schoolId, data.iern || data.schoolId,
          inv.building_name, inv.category, inv.status,
          sanitize(inv.no_of_storeys) || 1, sanitize(inv.no_of_classrooms),
          inv.year_completed || null, inv.remarks || ''
        ]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: "Facilities and details saved!" });

    // SNAPSHOT UPDATE (Primary)
    await calculateSchoolProgress(data.schoolId, pool);

    // --- DUAL WRITE: PHYSICAL FACILITIES (Async, Best Effort) ---
    if (poolNew) {
      (async () => {
        const clientNew = await poolNew.connect();
        try {
          await clientNew.query('BEGIN');
          console.log("🔄 Dual-Write: Syncing Physical Facilities...");

          // DW 1. Update Profile
          await clientNew.query(queryProfile, [
            data.schoolId,
            sanitize(data.build_classrooms_total),
            sanitize(data.build_classrooms_new),
            sanitize(data.build_classrooms_good),
            sanitize(data.build_classrooms_repair),
            sanitize(data.build_classrooms_demolition)
          ]);

          // DW 2. Repairs
          if (data.repairEntries) {
            await clientNew.query('DELETE FROM facility_repair_details WHERE school_id = $1', [data.schoolId]);

            for (const r of data.repairEntries) {
              await clientNew.query(`
                        INSERT INTO facility_repair_details (
                            school_id, iern, building_no, room_no, item_name,
                            oms, condition, damage_ratio, recommended_action, demo_justification, remarks
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, [
                data.schoolId, data.iern || data.schoolId,
                r.building_no, r.room_no, r.item_name,
                r.oms || '', r.condition || '', r.damage_ratio || 0,
                r.recommended_action || '', r.demo_justification || '', r.remarks || ''
              ]);
            }
          }

          // DW 3. Demolitions
          if (data.demolitionEntries) {
            await clientNew.query('DELETE FROM facility_demolitions WHERE school_id = $1', [data.schoolId]);
            for (const d of data.demolitionEntries) {
              await clientNew.query(`
                        INSERT INTO facility_demolitions (
                            school_id, iern, building_no,
                            reason_age, reason_safety, reason_calamity, reason_upgrade
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                data.schoolId, data.schoolId, d.building_no,
                toBool(d.reason_age), toBool(d.reason_safety), toBool(d.reason_calamity), toBool(d.reason_upgrade)
              ]);
            }
          }

          // DW 4. Building Inventory
          if (data.inventoryEntries) {
            await clientNew.query('DELETE FROM facility_inventory WHERE school_id = $1', [data.schoolId]);
            for (const inv of data.inventoryEntries) {
              await clientNew.query(`
                        INSERT INTO facility_inventory (
                            school_id, iern, building_name, category, status,
                            no_of_storeys, no_of_classrooms, year_completed, remarks
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [
                data.schoolId, data.iern || data.schoolId,
                inv.building_name, inv.category, inv.status,
                sanitize(inv.no_of_storeys) || 1, sanitize(inv.no_of_classrooms),
                inv.year_completed || null, inv.remarks || ''
              ]);
            }
          }

          await clientNew.query('COMMIT');
          await calculateSchoolProgress(data.schoolId, poolNew);
          console.log("✅ Dual-Write: Physical Facilities Synced!");
        } catch (dwErr) {
          await clientNew.query('ROLLBACK');
          console.error("❌ Dual-Write Error (Physical Facilities):", dwErr.message);
        } finally {
          clientNew.release();
        }
      })();
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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

// --- SUPER USER: Export Summary Endpoint ---
app.get('/api/super-user/export-summary', async (req, res) => {
  const { role, region, division, district } = req.query;
  try {
    const result = { context: { role: role || 'Central Office', location: '' }, generated_at: new Date().toISOString() };

    // Build location string for context
    if (district) result.context.location = `${district}, ${division}`;
    else if (division) result.context.location = `${division} Division`;
    else if (region) result.context.location = region;
    else result.context.location = 'National';

    // --- 1. School KPIs ---
    let schoolSql = `
      SELECT 
        COUNT(s.school_id) as total_schools,
        COALESCE(SUM(CASE WHEN sp.f1_profile > 0 THEN 1 ELSE 0 END), 0) as profile,
        COALESCE(SUM(CASE WHEN sp.f2_head > 0 THEN 1 ELSE 0 END), 0) as head,
        COALESCE(SUM(CASE WHEN sp.f3_enrollment > 0 THEN 1 ELSE 0 END), 0) as enrollment,
        COALESCE(SUM(CASE WHEN sp.f4_classes > 0 THEN 1 ELSE 0 END), 0) as organizedclasses,
        COALESCE(SUM(CASE WHEN sp.f5_teachers > 0 THEN 1 ELSE 0 END), 0) as personnel,
        COALESCE(SUM(CASE WHEN sp.f6_specialization > 0 THEN 1 ELSE 0 END), 0) as specialization,
        COALESCE(SUM(CASE WHEN sp.f7_resources > 0 THEN 1 ELSE 0 END), 0) as resources,
        COALESCE(SUM(CASE WHEN sp.f8_facilities > 0 THEN 1 ELSE 0 END), 0) as facilities,
        COALESCE(SUM(CASE WHEN sp.f9_shifting > 0 THEN 1 ELSE 0 END), 0) as shifting,
        COALESCE(SUM(CASE WHEN sp.f10_stats > 0 THEN 1 ELSE 0 END), 0) as learner_stats,
        COALESCE(COUNT(CASE WHEN sp.completion_percentage = 100 THEN 1 END), 0) as completed_schools,
        COALESCE(COUNT(CASE WHEN sp.completion_percentage = 100 AND (ss.data_health_description = 'Excellent' OR sp.school_head_validation = TRUE) THEN 1 END), 0) as validated_schools
      FROM schools s
      LEFT JOIN school_profiles sp ON s.school_id = sp.school_id
      LEFT JOIN school_summary ss ON s.school_id = ss.school_id
    `;
    let schoolParams = [];
    let schoolWhere = [];

    if (region) {
      schoolParams.push(region);
      schoolWhere.push(`TRIM(s.region) = TRIM($${schoolParams.length})`);
    }
    if (division) {
      schoolParams.push(division);
      schoolWhere.push(`TRIM(s.division) = TRIM($${schoolParams.length})`);
    }
    if (district) {
      schoolParams.push(district);
      schoolWhere.push(`TRIM(s.district) = TRIM($${schoolParams.length})`);
    }

    if (schoolWhere.length > 0) schoolSql += ' WHERE ' + schoolWhere.join(' AND ');

    const schoolRes = await pool.query(schoolSql, schoolParams);
    const sr = schoolRes.rows[0];
    const totalSchools = parseInt(sr.total_schools) || 0;

    result.school_kpis = {
      total_schools: totalSchools,
      completed: parseInt(sr.completed_schools) || 0,
      validated: parseInt(sr.validated_schools) || 0,
      completion_pct: totalSchools > 0 ? parseFloat(((parseInt(sr.completed_schools) / totalSchools) * 100).toFixed(1)) : 0,
      form_breakdown: {
        profile: parseInt(sr.profile) || 0,
        head: parseInt(sr.head) || 0,
        enrollment: parseInt(sr.enrollment) || 0,
        organizedclasses: parseInt(sr.organizedclasses) || 0,
        personnel: parseInt(sr.personnel) || 0,
        specialization: parseInt(sr.specialization) || 0,
        resources: parseInt(sr.resources) || 0,
        facilities: parseInt(sr.facilities) || 0,
        shifting: parseInt(sr.shifting) || 0,
        learner_stats: parseInt(sr.learner_stats) || 0,
      }
    };

    // --- 2. Engineer KPIs ---
    let engSql = `
      SELECT
        COUNT(*) as total_projects,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'Ongoing' THEN 1 END) as ongoing,
        COUNT(CASE WHEN status = 'Not Yet Started' THEN 1 END) as not_yet_started,
        COUNT(CASE WHEN status = 'Under Procurement' THEN 1 END) as under_procurement,
        COUNT(CASE WHEN status = 'For Final Inspection' THEN 1 END) as for_final_inspection
      FROM (
        SELECT DISTINCT ON (ipc) project_id, status, region, division
        FROM engineer_form
        ORDER BY ipc, project_id DESC
      ) latest
    `;
    let engParams = [];
    let engWhere = [];

    if (region) {
      engParams.push(region);
      engWhere.push(`TRIM(latest.region) = TRIM($${engParams.length})`);
    }
    if (division) {
      engParams.push(division);
      engWhere.push(`TRIM(latest.division) = TRIM($${engParams.length})`);
    }

    if (engWhere.length > 0) engSql += ' WHERE ' + engWhere.join(' AND ');

    const engRes = await pool.query(engSql, engParams);
    const er = engRes.rows[0];

    result.engineer_kpis = {
      total_projects: parseInt(er.total_projects) || 0,
      completed: parseInt(er.completed) || 0,
      ongoing: parseInt(er.ongoing) || 0,
      not_yet_started: parseInt(er.not_yet_started) || 0,
      under_procurement: parseInt(er.under_procurement) || 0,
      for_final_inspection: parseInt(er.for_final_inspection) || 0,
    };

    res.json(result);

  } catch (err) {
    console.error("Export Summary Error:", err);
    res.status(500).json({ error: err.message });
  }
});

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
        ROUND(COALESCE(AVG(sp.completion_percentage), 0), 1) as avg_completion,
        SUM(COALESCE(sp.total_enrollment, 0)) as total_enrollment,
        SUM(COALESCE(sp.grade_kinder, 0)) as grade_kinder,
        SUM(COALESCE(sp.grade_1, 0)) as grade_1,
        SUM(COALESCE(sp.grade_2, 0)) as grade_2,
        SUM(COALESCE(sp.grade_3, 0)) as grade_3,
        SUM(COALESCE(sp.grade_4, 0)) as grade_4,
        SUM(COALESCE(sp.grade_5, 0)) as grade_5,
        SUM(COALESCE(sp.grade_6, 0)) as grade_6,
        SUM(COALESCE(sp.grade_7, 0)) as grade_7,
        SUM(COALESCE(sp.grade_8, 0)) as grade_8,
        SUM(COALESCE(sp.grade_9, 0)) as grade_9,
        SUM(COALESCE(sp.grade_10, 0)) as grade_10,
        SUM(COALESCE(sp.grade_11, 0)) as grade_11,
        SUM(COALESCE(sp.grade_12, 0)) as grade_12,

        SUM(COALESCE(sp.classes_kinder, 0)) as classes_kinder,
        SUM(COALESCE(sp.classes_grade_1, 0)) as classes_grade_1,
        SUM(COALESCE(sp.classes_grade_2, 0)) as classes_grade_2,
        SUM(COALESCE(sp.classes_grade_3, 0)) as classes_grade_3,
        SUM(COALESCE(sp.classes_grade_4, 0)) as classes_grade_4,
        SUM(COALESCE(sp.classes_grade_5, 0)) as classes_grade_5,
        SUM(COALESCE(sp.classes_grade_6, 0)) as classes_grade_6,
        SUM(COALESCE(sp.classes_grade_7, 0)) as classes_grade_7,
        SUM(COALESCE(sp.classes_grade_8, 0)) as classes_grade_8,
        SUM(COALESCE(sp.classes_grade_9, 0)) as classes_grade_9,
        SUM(COALESCE(sp.classes_grade_10, 0)) as classes_grade_10,
        SUM(COALESCE(sp.classes_grade_11, 0)) as classes_grade_11,
        SUM(COALESCE(sp.classes_grade_12, 0)) as classes_grade_12,
        
        SUM(COALESCE(sp.aral_math_g1, 0)) as aral_math_g1,
        SUM(COALESCE(sp.aral_read_g1, 0)) as aral_read_g1,
        SUM(COALESCE(sp.aral_sci_g1, 0)) as aral_sci_g1,
        SUM(COALESCE(sp.aral_math_g2, 0)) as aral_math_g2,
        SUM(COALESCE(sp.aral_read_g2, 0)) as aral_read_g2,
        SUM(COALESCE(sp.aral_sci_g2, 0)) as aral_sci_g2,
        SUM(COALESCE(sp.aral_math_g3, 0)) as aral_math_g3,
        SUM(COALESCE(sp.aral_read_g3, 0)) as aral_read_g3,
        SUM(COALESCE(sp.aral_sci_g3, 0)) as aral_sci_g3,
        SUM(COALESCE(sp.aral_math_g4, 0)) as aral_math_g4,
        SUM(COALESCE(sp.aral_read_g4, 0)) as aral_read_g4,
        SUM(COALESCE(sp.aral_sci_g4, 0)) as aral_sci_g4,
        SUM(COALESCE(sp.aral_math_g5, 0)) as aral_math_g5,
        SUM(COALESCE(sp.aral_read_g5, 0)) as aral_read_g5,
        SUM(COALESCE(sp.aral_sci_g5, 0)) as aral_sci_g5,
        SUM(COALESCE(sp.aral_math_g6, 0)) as aral_math_g6,
        SUM(COALESCE(sp.aral_read_g6, 0)) as aral_read_g6,
        SUM(COALESCE(sp.aral_sci_g6, 0)) as aral_sci_g6,

        SUM(COALESCE(sp.cnt_less_kinder, 0)) as cnt_less_kinder,
        SUM(COALESCE(sp.cnt_within_kinder, 0)) as cnt_within_kinder,
        SUM(COALESCE(sp.cnt_above_kinder, 0)) as cnt_above_kinder,
        
        SUM(COALESCE(sp.cnt_less_g1, 0)) as cnt_less_g1,
        SUM(COALESCE(sp.cnt_within_g1, 0)) as cnt_within_g1,
        SUM(COALESCE(sp.cnt_above_g1, 0)) as cnt_above_g1,
        
        SUM(COALESCE(sp.cnt_less_g2, 0)) as cnt_less_g2,
        SUM(COALESCE(sp.cnt_within_g2, 0)) as cnt_within_g2,
        SUM(COALESCE(sp.cnt_above_g2, 0)) as cnt_above_g2,
        
        SUM(COALESCE(sp.cnt_less_g3, 0)) as cnt_less_g3,
        SUM(COALESCE(sp.cnt_within_g3, 0)) as cnt_within_g3,
        SUM(COALESCE(sp.cnt_above_g3, 0)) as cnt_above_g3,
        
        SUM(COALESCE(sp.cnt_less_g4, 0)) as cnt_less_g4,
        SUM(COALESCE(sp.cnt_within_g4, 0)) as cnt_within_g4,
        SUM(COALESCE(sp.cnt_above_g4, 0)) as cnt_above_g4,
        
        SUM(COALESCE(sp.cnt_less_g5, 0)) as cnt_less_g5,
        SUM(COALESCE(sp.cnt_within_g5, 0)) as cnt_within_g5,
        SUM(COALESCE(sp.cnt_above_g5, 0)) as cnt_above_g5,
        
        SUM(COALESCE(sp.cnt_less_g6, 0)) as cnt_less_g6,
        SUM(COALESCE(sp.cnt_within_g6, 0)) as cnt_within_g6,
        SUM(COALESCE(sp.cnt_above_g6, 0)) as cnt_above_g6,
        
        SUM(COALESCE(sp.cnt_less_g7, 0)) as cnt_less_g7,
        SUM(COALESCE(sp.cnt_within_g7, 0)) as cnt_within_g7,
        SUM(COALESCE(sp.cnt_above_g7, 0)) as cnt_above_g7,
        
        SUM(COALESCE(sp.cnt_less_g8, 0)) as cnt_less_g8,
        SUM(COALESCE(sp.cnt_within_g8, 0)) as cnt_within_g8,
        SUM(COALESCE(sp.cnt_above_g8, 0)) as cnt_above_g8,
        
        SUM(COALESCE(sp.cnt_less_g9, 0)) as cnt_less_g9,
        SUM(COALESCE(sp.cnt_within_g9, 0)) as cnt_within_g9,
        SUM(COALESCE(sp.cnt_above_g9, 0)) as cnt_above_g9,
        
        SUM(COALESCE(sp.cnt_less_g10, 0)) as cnt_less_g10,
        SUM(COALESCE(sp.cnt_within_g10, 0)) as cnt_within_g10,
        SUM(COALESCE(sp.cnt_above_g10, 0)) as cnt_above_g10,
        
        SUM(COALESCE(sp.cnt_less_g11, 0)) as cnt_less_g11,
        SUM(COALESCE(sp.cnt_within_g11, 0)) as cnt_within_g11,
        SUM(COALESCE(sp.cnt_above_g11, 0)) as cnt_above_g11,
        
        SUM(COALESCE(sp.cnt_less_g12, 0)) as cnt_less_g12,
        SUM(COALESCE(sp.cnt_within_g12, 0)) as cnt_within_g12,
        SUM(COALESCE(sp.cnt_above_g12, 0)) as cnt_above_g12,

        -- SNED
        SUM(COALESCE(sp.stat_sned_k, 0)) as stat_sned_k,
        SUM(COALESCE(sp.stat_sned_g1, 0)) as stat_sned_g1,
        SUM(COALESCE(sp.stat_sned_g2, 0)) as stat_sned_g2,
        SUM(COALESCE(sp.stat_sned_g3, 0)) as stat_sned_g3,
        SUM(COALESCE(sp.stat_sned_g4, 0)) as stat_sned_g4,
        SUM(COALESCE(sp.stat_sned_g5, 0)) as stat_sned_g5,
        SUM(COALESCE(sp.stat_sned_g6, 0)) as stat_sned_g6,
        SUM(COALESCE(sp.stat_sned_g7, 0)) as stat_sned_g7,
        SUM(COALESCE(sp.stat_sned_g8, 0)) as stat_sned_g8,
        SUM(COALESCE(sp.stat_sned_g9, 0)) as stat_sned_g9,
        SUM(COALESCE(sp.stat_sned_g10, 0)) as stat_sned_g10,
        SUM(COALESCE(sp.stat_sned_g11, 0)) as stat_sned_g11,
        SUM(COALESCE(sp.stat_sned_g12, 0)) as stat_sned_g12,

        -- DISABILITY
        SUM(COALESCE(sp.stat_disability_k, 0)) as stat_disability_k,
        SUM(COALESCE(sp.stat_disability_g1, 0)) as stat_disability_g1,
        SUM(COALESCE(sp.stat_disability_g2, 0)) as stat_disability_g2,
        SUM(COALESCE(sp.stat_disability_g3, 0)) as stat_disability_g3,
        SUM(COALESCE(sp.stat_disability_g4, 0)) as stat_disability_g4,
        SUM(COALESCE(sp.stat_disability_g5, 0)) as stat_disability_g5,
        SUM(COALESCE(sp.stat_disability_g6, 0)) as stat_disability_g6,
        SUM(COALESCE(sp.stat_disability_g7, 0)) as stat_disability_g7,
        SUM(COALESCE(sp.stat_disability_g8, 0)) as stat_disability_g8,
        SUM(COALESCE(sp.stat_disability_g9, 0)) as stat_disability_g9,
        SUM(COALESCE(sp.stat_disability_g10, 0)) as stat_disability_g10,
        SUM(COALESCE(sp.stat_disability_g11, 0)) as stat_disability_g11,
        SUM(COALESCE(sp.stat_disability_g12, 0)) as stat_disability_g12,

        -- ALS
        SUM(COALESCE(sp.stat_als_k, 0)) as stat_als_k,
        SUM(COALESCE(sp.stat_als_g1, 0)) as stat_als_g1,
        SUM(COALESCE(sp.stat_als_g2, 0)) as stat_als_g2,
        SUM(COALESCE(sp.stat_als_g3, 0)) as stat_als_g3,
        SUM(COALESCE(sp.stat_als_g4, 0)) as stat_als_g4,
        SUM(COALESCE(sp.stat_als_g5, 0)) as stat_als_g5,
        SUM(COALESCE(sp.stat_als_g6, 0)) as stat_als_g6,
        SUM(COALESCE(sp.stat_als_g7, 0)) as stat_als_g7,
        SUM(COALESCE(sp.stat_als_g8, 0)) as stat_als_g8,
        SUM(COALESCE(sp.stat_als_g9, 0)) as stat_als_g9,
        SUM(COALESCE(sp.stat_als_g10, 0)) as stat_als_g10,
        SUM(COALESCE(sp.stat_als_g11, 0)) as stat_als_g11,
        SUM(COALESCE(sp.stat_als_g12, 0)) as stat_als_g12,

        -- MUSLIM
        SUM(COALESCE(sp.stat_muslim_k, 0)) as stat_muslim_k,
        SUM(COALESCE(sp.stat_muslim_g1, 0)) as stat_muslim_g1,
        SUM(COALESCE(sp.stat_muslim_g2, 0)) as stat_muslim_g2,
        SUM(COALESCE(sp.stat_muslim_g3, 0)) as stat_muslim_g3,
        SUM(COALESCE(sp.stat_muslim_g4, 0)) as stat_muslim_g4,
        SUM(COALESCE(sp.stat_muslim_g5, 0)) as stat_muslim_g5,
        SUM(COALESCE(sp.stat_muslim_g6, 0)) as stat_muslim_g6,
        SUM(COALESCE(sp.stat_muslim_g7, 0)) as stat_muslim_g7,
        SUM(COALESCE(sp.stat_muslim_g8, 0)) as stat_muslim_g8,
        SUM(COALESCE(sp.stat_muslim_g9, 0)) as stat_muslim_g9,
        SUM(COALESCE(sp.stat_muslim_g10, 0)) as stat_muslim_g10,
        SUM(COALESCE(sp.stat_muslim_g11, 0)) as stat_muslim_g11,
        SUM(COALESCE(sp.stat_muslim_g12, 0)) as stat_muslim_g12,

        -- IP
        SUM(COALESCE(sp.stat_ip_k, 0)) as stat_ip_k,
        SUM(COALESCE(sp.stat_ip_g1, 0)) as stat_ip_g1,
        SUM(COALESCE(sp.stat_ip_g2, 0)) as stat_ip_g2,
        SUM(COALESCE(sp.stat_ip_g3, 0)) as stat_ip_g3,
        SUM(COALESCE(sp.stat_ip_g4, 0)) as stat_ip_g4,
        SUM(COALESCE(sp.stat_ip_g5, 0)) as stat_ip_g5,
        SUM(COALESCE(sp.stat_ip_g6, 0)) as stat_ip_g6,
        SUM(COALESCE(sp.stat_ip_g7, 0)) as stat_ip_g7,
        SUM(COALESCE(sp.stat_ip_g8, 0)) as stat_ip_g8,
        SUM(COALESCE(sp.stat_ip_g9, 0)) as stat_ip_g9,
        SUM(COALESCE(sp.stat_ip_g10, 0)) as stat_ip_g10,
        SUM(COALESCE(sp.stat_ip_g11, 0)) as stat_ip_g11,
        SUM(COALESCE(sp.stat_ip_g12, 0)) as stat_ip_g12,

        -- DISPLACED
        SUM(COALESCE(sp.stat_displaced_k, 0)) as stat_displaced_k,
        SUM(COALESCE(sp.stat_displaced_g1, 0)) as stat_displaced_g1,
        SUM(COALESCE(sp.stat_displaced_g2, 0)) as stat_displaced_g2,
        SUM(COALESCE(sp.stat_displaced_g3, 0)) as stat_displaced_g3,
        SUM(COALESCE(sp.stat_displaced_g4, 0)) as stat_displaced_g4,
        SUM(COALESCE(sp.stat_displaced_g5, 0)) as stat_displaced_g5,
        SUM(COALESCE(sp.stat_displaced_g6, 0)) as stat_displaced_g6,
        SUM(COALESCE(sp.stat_displaced_g7, 0)) as stat_displaced_g7,
        SUM(COALESCE(sp.stat_displaced_g8, 0)) as stat_displaced_g8,
        SUM(COALESCE(sp.stat_displaced_g9, 0)) as stat_displaced_g9,
        SUM(COALESCE(sp.stat_displaced_g10, 0)) as stat_displaced_g10,
        SUM(COALESCE(sp.stat_displaced_g11, 0)) as stat_displaced_g11,
        SUM(COALESCE(sp.stat_displaced_g12, 0)) as stat_displaced_g12,

        -- REPETITION
        SUM(COALESCE(sp.stat_repetition_k, 0)) as stat_repetition_k,
        SUM(COALESCE(sp.stat_repetition_g1, 0)) as stat_repetition_g1,
        SUM(COALESCE(sp.stat_repetition_g2, 0)) as stat_repetition_g2,
        SUM(COALESCE(sp.stat_repetition_g3, 0)) as stat_repetition_g3,
        SUM(COALESCE(sp.stat_repetition_g4, 0)) as stat_repetition_g4,
        SUM(COALESCE(sp.stat_repetition_g5, 0)) as stat_repetition_g5,
        SUM(COALESCE(sp.stat_repetition_g6, 0)) as stat_repetition_g6,
        SUM(COALESCE(sp.stat_repetition_g7, 0)) as stat_repetition_g7,
        SUM(COALESCE(sp.stat_repetition_g8, 0)) as stat_repetition_g8,
        SUM(COALESCE(sp.stat_repetition_g9, 0)) as stat_repetition_g9,
        SUM(COALESCE(sp.stat_repetition_g10, 0)) as stat_repetition_g10,
        SUM(COALESCE(sp.stat_repetition_g11, 0)) as stat_repetition_g11,
        SUM(COALESCE(sp.stat_repetition_g12, 0)) as stat_repetition_g12,

        -- OVERAGE
        SUM(COALESCE(sp.stat_overage_k, 0)) as stat_overage_k,
        SUM(COALESCE(sp.stat_overage_g1, 0)) as stat_overage_g1,
        SUM(COALESCE(sp.stat_overage_g2, 0)) as stat_overage_g2,
        SUM(COALESCE(sp.stat_overage_g3, 0)) as stat_overage_g3,
        SUM(COALESCE(sp.stat_overage_g4, 0)) as stat_overage_g4,
        SUM(COALESCE(sp.stat_overage_g5, 0)) as stat_overage_g5,
        SUM(COALESCE(sp.stat_overage_g6, 0)) as stat_overage_g6,
        SUM(COALESCE(sp.stat_overage_g7, 0)) as stat_overage_g7,
        SUM(COALESCE(sp.stat_overage_g8, 0)) as stat_overage_g8,
        SUM(COALESCE(sp.stat_overage_g9, 0)) as stat_overage_g9,
        SUM(COALESCE(sp.stat_overage_g10, 0)) as stat_overage_g10,
        SUM(COALESCE(sp.stat_overage_g11, 0)) as stat_overage_g11,
        SUM(COALESCE(sp.stat_overage_g12, 0)) as stat_overage_g12,

        -- DROPOUT
        SUM(COALESCE(sp.stat_dropout_k, 0)) as stat_dropout_k,
        SUM(COALESCE(sp.stat_dropout_g1, 0)) as stat_dropout_g1,
        SUM(COALESCE(sp.stat_dropout_g2, 0)) as stat_dropout_g2,
        SUM(COALESCE(sp.stat_dropout_g3, 0)) as stat_dropout_g3,
        SUM(COALESCE(sp.stat_dropout_g4, 0)) as stat_dropout_g4,
        SUM(COALESCE(sp.stat_dropout_g5, 0)) as stat_dropout_g5,
        SUM(COALESCE(sp.stat_dropout_g6, 0)) as stat_dropout_g6,
        SUM(COALESCE(sp.stat_dropout_g7, 0)) as stat_dropout_g7,
        SUM(COALESCE(sp.stat_dropout_g8, 0)) as stat_dropout_g8,
        SUM(COALESCE(sp.stat_dropout_g9, 0)) as stat_dropout_g9,
        SUM(COALESCE(sp.stat_dropout_g10, 0)) as stat_dropout_g10,
        SUM(COALESCE(sp.stat_dropout_g11, 0)) as stat_dropout_g11,
        SUM(COALESCE(sp.stat_dropout_g12, 0)) as stat_dropout_g12,

        -- SHIFTING METRICS
        SUM(CASE WHEN sp.shift_kinder = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_k,
        SUM(CASE WHEN sp.shift_kinder = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_k,
        SUM(CASE WHEN sp.shift_kinder = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_k,
        SUM(CASE WHEN sp.shift_g1 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g1,
        SUM(CASE WHEN sp.shift_g1 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g1,
        SUM(CASE WHEN sp.shift_g1 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g1,
        SUM(CASE WHEN sp.shift_g2 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g2,
        SUM(CASE WHEN sp.shift_g2 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g2,
        SUM(CASE WHEN sp.shift_g2 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g2,
        SUM(CASE WHEN sp.shift_g3 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g3,
        SUM(CASE WHEN sp.shift_g3 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g3,
        SUM(CASE WHEN sp.shift_g3 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g3,
        SUM(CASE WHEN sp.shift_g4 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g4,
        SUM(CASE WHEN sp.shift_g4 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g4,
        SUM(CASE WHEN sp.shift_g4 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g4,
        SUM(CASE WHEN sp.shift_g5 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g5,
        SUM(CASE WHEN sp.shift_g5 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g5,
        SUM(CASE WHEN sp.shift_g5 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g5,
        SUM(CASE WHEN sp.shift_g6 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g6,
        SUM(CASE WHEN sp.shift_g6 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g6,
        SUM(CASE WHEN sp.shift_g6 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g6,
        SUM(CASE WHEN sp.shift_g7 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g7,
        SUM(CASE WHEN sp.shift_g7 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g7,
        SUM(CASE WHEN sp.shift_g7 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g7,
        SUM(CASE WHEN sp.shift_g8 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g8,
        SUM(CASE WHEN sp.shift_g8 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g8,
        SUM(CASE WHEN sp.shift_g8 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g8,
        SUM(CASE WHEN sp.shift_g9 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g9,
        SUM(CASE WHEN sp.shift_g9 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g9,
        SUM(CASE WHEN sp.shift_g9 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g9,
        SUM(CASE WHEN sp.shift_g10 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g10,
        SUM(CASE WHEN sp.shift_g10 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g10,
        SUM(CASE WHEN sp.shift_g10 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g10,
        SUM(CASE WHEN sp.shift_g11 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g11,
        SUM(CASE WHEN sp.shift_g11 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g11,
        SUM(CASE WHEN sp.shift_g11 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g11,
        SUM(CASE WHEN sp.shift_g12 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g12,
        SUM(CASE WHEN sp.shift_g12 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g12,
        SUM(CASE WHEN sp.shift_g12 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g12,

        -- LEARNING DELIVERY METRICS
        SUM(CASE WHEN sp.mode_kinder = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_k,
        SUM(CASE WHEN sp.mode_kinder LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_k,
        SUM(CASE WHEN sp.mode_kinder = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_k,
        SUM(CASE WHEN sp.mode_g1 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g1,
        SUM(CASE WHEN sp.mode_g1 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g1,
        SUM(CASE WHEN sp.mode_g1 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g1,
        SUM(CASE WHEN sp.mode_g2 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g2,
        SUM(CASE WHEN sp.mode_g2 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g2,
        SUM(CASE WHEN sp.mode_g2 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g2,
        SUM(CASE WHEN sp.mode_g3 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g3,
        SUM(CASE WHEN sp.mode_g3 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g3,
        SUM(CASE WHEN sp.mode_g3 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g3,
        SUM(CASE WHEN sp.mode_g4 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g4,
        SUM(CASE WHEN sp.mode_g4 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g4,
        SUM(CASE WHEN sp.mode_g4 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g4,
        SUM(CASE WHEN sp.mode_g5 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g5,
        SUM(CASE WHEN sp.mode_g5 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g5,
        SUM(CASE WHEN sp.mode_g5 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g5,
        SUM(CASE WHEN sp.mode_g6 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g6,
        SUM(CASE WHEN sp.mode_g6 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g6,
        SUM(CASE WHEN sp.mode_g6 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g6,
        SUM(CASE WHEN sp.mode_g7 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g7,
        SUM(CASE WHEN sp.mode_g7 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g7,
        SUM(CASE WHEN sp.mode_g7 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g7,
        SUM(CASE WHEN sp.mode_g8 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g8,
        SUM(CASE WHEN sp.mode_g8 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g8,
        SUM(CASE WHEN sp.mode_g8 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g8,
        SUM(CASE WHEN sp.mode_g9 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g9,
        SUM(CASE WHEN sp.mode_g9 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g9,
        SUM(CASE WHEN sp.mode_g9 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g9,
        SUM(CASE WHEN sp.mode_g10 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g10,
        SUM(CASE WHEN sp.mode_g10 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g10,
        SUM(CASE WHEN sp.mode_g10 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g10,
        SUM(CASE WHEN sp.mode_g11 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g11,
        SUM(CASE WHEN sp.mode_g11 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g11,
        SUM(CASE WHEN sp.mode_g11 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g11,
        SUM(CASE WHEN sp.mode_g12 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g12,
        SUM(CASE WHEN sp.mode_g12 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g12,
        SUM(CASE WHEN sp.mode_g12 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g12,

        -- EMERGENCY ADM METRICS
        SUM(CASE WHEN sp.adm_mdl IS TRUE THEN 1 ELSE 0 END) as cnt_adm_mdl,
        SUM(CASE WHEN sp.adm_odl IS TRUE THEN 1 ELSE 0 END) as cnt_adm_odl,
        SUM(CASE WHEN sp.adm_tvi IS TRUE THEN 1 ELSE 0 END) as cnt_adm_tvi,
        SUM(CASE WHEN sp.adm_blended IS TRUE THEN 1 ELSE 0 END) as cnt_adm_blended,

        -- TEACHER METRICS (COUNT BY GRADE/LEVEL)
        SUM(sp.teach_kinder) as cnt_teach_k,
        SUM(sp.teach_g1) as cnt_teach_g1,
        SUM(sp.teach_g2) as cnt_teach_g2,
        SUM(sp.teach_g3) as cnt_teach_g3,
        SUM(sp.teach_g4) as cnt_teach_g4,
        SUM(sp.teach_g5) as cnt_teach_g5,
        SUM(sp.teach_g6) as cnt_teach_g6,
        SUM(sp.teach_g7) as cnt_teach_g7,
        SUM(sp.teach_g8) as cnt_teach_g8,
        SUM(sp.teach_g9) as cnt_teach_g9,
        SUM(sp.teach_g10) as cnt_teach_g10,
        SUM(sp.teach_g11) as cnt_teach_g11,
        SUM(sp.teach_g12) as cnt_teach_g12,

        -- MULTIGRADE TEACHERS
        SUM(sp.teach_multi_1_2) as cnt_multi_1_2,
        SUM(sp.teach_multi_3_4) as cnt_multi_3_4,
        SUM(sp.teach_multi_5_6) as cnt_multi_5_6,

        -- TEACHING EXPERIENCE
        SUM(sp.teach_exp_0_1) as cnt_exp_0_1,
        SUM(sp.teach_exp_2_5) as cnt_exp_2_5,
        SUM(sp.teach_exp_6_10) as cnt_exp_6_10,
        SUM(sp.teach_exp_11_15) as cnt_exp_11_15,
        SUM(sp.teach_exp_16_20) as cnt_exp_16_20,
        SUM(sp.teach_exp_21_25) as cnt_exp_21_25,
        SUM(sp.teach_exp_26_30) as cnt_exp_26_30,
        SUM(sp.teach_exp_31_35) as cnt_exp_31_35,
        SUM(sp.teach_exp_36_40) as cnt_exp_36_40,
        SUM(sp.teach_exp_40_45) as cnt_exp_40_45,

        -- SPECIALIZATION (MAJORS)
        SUM(sp.spec_math_major) as cnt_spec_math,
        SUM(sp.spec_science_major) as cnt_spec_sci,
        SUM(sp.spec_english_major) as cnt_spec_eng,
        SUM(sp.spec_filipino_major) as cnt_spec_fil,
        SUM(sp.spec_ap_major) as cnt_spec_ap,
        SUM(sp.spec_mapeh_major) as cnt_spec_mapeh,
        SUM(sp.spec_esp_major) as cnt_spec_esp,
        SUM(sp.spec_tle_major) as cnt_spec_tle,
        SUM(sp.spec_general_major) as cnt_spec_gen,
        SUM(sp.spec_ece_major) as cnt_spec_ece,

        -- CLASSROOMS (Condition)
        SUM(sp.build_classrooms_new) as cnt_class_new,
        SUM(sp.build_classrooms_good) as cnt_class_good,
        SUM(sp.build_classrooms_repair) as cnt_class_repair,
        SUM(sp.build_classrooms_demolition) as cnt_class_demolish,

        -- EQUIPMENT & INVENTORY
        SUM(sp.res_ecart_func) as cnt_equip_ecart_func,
        SUM(sp.res_ecart_nonfunc) as cnt_equip_ecart_non,
        SUM(sp.res_laptop_func) as cnt_equip_laptop_func,
        SUM(sp.res_laptop_nonfunc) as cnt_equip_laptop_non,
        SUM(sp.res_printer_func) as cnt_equip_printer_func,
        SUM(sp.res_printer_nonfunc) as cnt_equip_printer_non,
        SUM(sp.res_tv_func) as cnt_equip_tv_func,
        SUM(sp.res_tv_nonfunc) as cnt_equip_tv_non,

        -- SEATS (By Grade)
        SUM(sp.seats_kinder) as cnt_seats_k,
        SUM(sp.seats_grade_1) as cnt_seats_g1,
        SUM(sp.seats_grade_2) as cnt_seats_g2,
        SUM(sp.seats_grade_3) as cnt_seats_g3,
        SUM(sp.seats_grade_4) as cnt_seats_g4,
        SUM(sp.seats_grade_5) as cnt_seats_g5,
        SUM(sp.seats_grade_6) as cnt_seats_g6,
        SUM(sp.seats_grade_7) as cnt_seats_g7,
        SUM(sp.seats_grade_8) as cnt_seats_g8,
        SUM(sp.seats_grade_9) as cnt_seats_g9,
        SUM(sp.seats_grade_10) as cnt_seats_g10,
        SUM(sp.seats_grade_11) as cnt_seats_g11,
        SUM(sp.seats_grade_12) as cnt_seats_g12,

        -- TOILETS (Comfort Rooms)
        SUM(sp.res_toilets_male) as cnt_toilet_male,
        SUM(sp.res_toilets_female) as cnt_toilet_female,
        SUM(sp.res_toilets_pwd) as cnt_toilet_pwd,
        SUM(sp.res_toilets_common) as cnt_toilet_common,

        -- SPECIALIZED ROOMS
        SUM(sp.res_sci_labs) as cnt_room_sci,
        SUM(sp.res_com_labs) as cnt_room_com,
        SUM(sp.res_tvl_workshops) as cnt_room_tvl,

        -- SITE & UTILITIES
        -- Electricity
        SUM(CASE WHEN sp.res_electricity_source = 'GRID SUPPLY' THEN 1 ELSE 0 END) as cnt_site_elec_grid,
        SUM(CASE WHEN sp.res_electricity_source LIKE '%OFF-GRID%' THEN 1 ELSE 0 END) as cnt_site_elec_offgrid,
        SUM(CASE WHEN sp.res_electricity_source = 'NO ELECTRICITY' THEN 1 ELSE 0 END) as cnt_site_elec_none,
        
        -- Water
        SUM(CASE WHEN sp.res_water_source LIKE '%Piped%' THEN 1 ELSE 0 END) as cnt_site_water_piped,
        SUM(CASE WHEN sp.res_water_source = 'Natural Resources' THEN 1 ELSE 0 END) as cnt_site_water_natural,
        SUM(CASE WHEN sp.res_water_source = 'No Water Source' THEN 1 ELSE 0 END) as cnt_site_water_none,

        -- Buildable Space
        SUM(CASE WHEN sp.res_buildable_space = 'Yes' THEN 1 ELSE 0 END) as cnt_site_build_yes,
        SUM(CASE WHEN sp.res_buildable_space = 'No' THEN 1 ELSE 0 END) as cnt_site_build_no,

        -- SHA (Hardship)
        SUM(CASE WHEN sp.sha_category LIKE '%HARDSHIP%' THEN 1 ELSE 0 END) as cnt_site_sha_hardship,
        SUM(CASE WHEN sp.sha_category LIKE '%MULTIGRADE%' THEN 1 ELSE 0 END) as cnt_site_sha_multi,


        -- HIERARCHICAL AGGREGATES
        
        -- SNED (Sum of Levels - Calculated from grades as requested)
        SUM(
            COALESCE(sp.stat_sned_k, 0) + 
            COALESCE(sp.stat_sned_g1, 0) + COALESCE(sp.stat_sned_g2, 0) + COALESCE(sp.stat_sned_g3, 0) + 
            COALESCE(sp.stat_sned_g4, 0) + COALESCE(sp.stat_sned_g5, 0) + COALESCE(sp.stat_sned_g6, 0)
        ) as stat_sned_es,
        
        SUM(
            COALESCE(sp.stat_sned_g7, 0) + COALESCE(sp.stat_sned_g8, 0) + 
            COALESCE(sp.stat_sned_g9, 0) + COALESCE(sp.stat_sned_g10, 0)
        ) as stat_sned_jhs,
        
        SUM(COALESCE(sp.stat_sned_g11, 0) + COALESCE(sp.stat_sned_g12, 0)) as stat_sned_shs,
        
        SUM(
            COALESCE(sp.stat_sned_k, 0) + 
            COALESCE(sp.stat_sned_g1, 0) + COALESCE(sp.stat_sned_g2, 0) + COALESCE(sp.stat_sned_g3, 0) + 
            COALESCE(sp.stat_sned_g4, 0) + COALESCE(sp.stat_sned_g5, 0) + COALESCE(sp.stat_sned_g6, 0) + 
            COALESCE(sp.stat_sned_g7, 0) + COALESCE(sp.stat_sned_g8, 0) + COALESCE(sp.stat_sned_g9, 0) + 
            COALESCE(sp.stat_sned_g10, 0) + COALESCE(sp.stat_sned_g11, 0) + COALESCE(sp.stat_sned_g12, 0)
        ) as stat_sned_total,

        -- DISABILITY (Sum of Levels)
        SUM(COALESCE(sp.stat_disability_es, 0)) as stat_disability_es,
        SUM(COALESCE(sp.stat_disability_jhs, 0)) as stat_disability_jhs,
        SUM(COALESCE(sp.stat_disability_shs, 0)) as stat_disability_shs,
        SUM(COALESCE(sp.stat_disability_es, 0) + COALESCE(sp.stat_disability_jhs, 0) + COALESCE(sp.stat_disability_shs, 0)) as stat_disability_total,

        -- ALS (Sum of Levels)
        SUM(COALESCE(sp.stat_als_es, 0)) as stat_als_es,
        SUM(COALESCE(sp.stat_als_jhs, 0)) as stat_als_jhs,
        SUM(COALESCE(sp.stat_als_shs, 0)) as stat_als_shs,
        SUM(COALESCE(sp.stat_als_es, 0) + COALESCE(sp.stat_als_jhs, 0) + COALESCE(sp.stat_als_shs, 0)) as stat_als_total,

        -- MUSLIM (Sum of Grades, as aggregates missing)
        SUM(
            COALESCE(sp.stat_muslim_k, 0) + COALESCE(sp.stat_muslim_g1, 0) + COALESCE(sp.stat_muslim_g2, 0) + 
            COALESCE(sp.stat_muslim_g3, 0) + COALESCE(sp.stat_muslim_g4, 0) + COALESCE(sp.stat_muslim_g5, 0) + 
            COALESCE(sp.stat_muslim_g6, 0)
        ) as stat_muslim_es,
        SUM(
            COALESCE(sp.stat_muslim_g7, 0) + COALESCE(sp.stat_muslim_g8, 0) + COALESCE(sp.stat_muslim_g9, 0) + 
            COALESCE(sp.stat_muslim_g10, 0)
        ) as stat_muslim_jhs,
        SUM(COALESCE(sp.stat_muslim_g11, 0) + COALESCE(sp.stat_muslim_g12, 0)) as stat_muslim_shs,
        SUM(
            COALESCE(sp.stat_muslim_k, 0) + COALESCE(sp.stat_muslim_g1, 0) + COALESCE(sp.stat_muslim_g2, 0) + 
            COALESCE(sp.stat_muslim_g3, 0) + COALESCE(sp.stat_muslim_g4, 0) + COALESCE(sp.stat_muslim_g5, 0) + 
            COALESCE(sp.stat_muslim_g6, 0) + COALESCE(sp.stat_muslim_g7, 0) + COALESCE(sp.stat_muslim_g8, 0) + 
            COALESCE(sp.stat_muslim_g9, 0) + COALESCE(sp.stat_muslim_g10, 0) + COALESCE(sp.stat_muslim_g11, 0) + 
            COALESCE(sp.stat_muslim_g12, 0)
        ) as stat_muslim_total,

        -- IP (Existing Total)
        SUM(COALESCE(sp.stat_ip_es, 0)) as stat_ip_es,
        SUM(COALESCE(sp.stat_ip_jhs, 0)) as stat_ip_jhs,
        SUM(COALESCE(sp.stat_ip_shs, 0)) as stat_ip_shs,
        SUM(COALESCE(sp.stat_ip, 0)) as stat_ip_total,

        -- DISPLACED (Existing Total)
        SUM(COALESCE(sp.stat_displaced_es, 0)) as stat_displaced_es,
        SUM(COALESCE(sp.stat_displaced_jhs, 0)) as stat_displaced_jhs,
        SUM(COALESCE(sp.stat_displaced_shs, 0)) as stat_displaced_shs,
        SUM(COALESCE(sp.stat_displaced, 0)) as stat_displaced_total,

        -- REPETITION (Existing Total)
        SUM(COALESCE(sp.stat_repetition_es, 0)) as stat_repetition_es,
        SUM(COALESCE(sp.stat_repetition_jhs, 0)) as stat_repetition_jhs,
        SUM(COALESCE(sp.stat_repetition_shs, 0)) as stat_repetition_shs,
        SUM(COALESCE(sp.stat_repetition, 0)) as stat_repetition_total,

        -- OVERAGE (Existing Total)
        SUM(COALESCE(sp.stat_overage_es, 0)) as stat_overage_es,
        SUM(COALESCE(sp.stat_overage_jhs, 0)) as stat_overage_jhs,
        SUM(COALESCE(sp.stat_overage_shs, 0)) as stat_overage_shs,
        SUM(COALESCE(sp.stat_overage, 0)) as stat_overage_total,

        -- DROPOUT (Sum of Levels, missing Total)
        SUM(COALESCE(sp.stat_dropout_es, 0)) as stat_dropout_es,
        SUM(COALESCE(sp.stat_dropout_jhs, 0)) as stat_dropout_jhs,
        SUM(COALESCE(sp.stat_dropout_shs, 0)) as stat_dropout_shs,
        SUM(COALESCE(sp.stat_dropout_es, 0) + COALESCE(sp.stat_dropout_jhs, 0) + COALESCE(sp.stat_dropout_shs, 0)) as stat_dropout_total
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
  const { region, division, groupBy } = req.query;
  // console.log("DEBUG: FETCHING DISTRICT STATS FOR:", region, division, groupBy); // Original line
  // console.log("District Stats Query:", { region, division, groupBy }); // DEBUG LOG

  let groupCol = 's.district';
  if (groupBy === 'legislative') groupCol = 's.legislative_district';
  if (groupBy === 'municipality') groupCol = 's.municipality';

  // console.log("Grouping By:", groupCol); // DEBUG LOG

  try {
    // REFACTOR: Use 'schools' table as base
    const query = `
      SELECT 
        ${groupCol} as district, 
        COUNT(s.school_id) as total_schools, 
        COUNT(CASE WHEN sp.completion_percentage = 100 THEN 1 END) as completed_schools,
        COUNT(CASE WHEN sp.completion_percentage = 100 AND (ss.data_health_description = 'Excellent' OR sp.school_head_validation = TRUE) THEN 1 END) as validated_schools,
        COUNT(CASE WHEN sp.completion_percentage = 100 AND ss.data_health_description IS NOT NULL AND ss.data_health_description != 'Excellent' THEN 1 END) as for_validation_schools,
        ROUND(COALESCE(AVG(sp.completion_percentage), 0), 1) as avg_completion,
        SUM(COALESCE(sp.total_enrollment, 0)) as total_enrollment,
        SUM(COALESCE(sp.grade_kinder, 0)) as grade_kinder,
        SUM(COALESCE(sp.grade_1, 0)) as grade_1,
        SUM(COALESCE(sp.grade_2, 0)) as grade_2,
        SUM(COALESCE(sp.grade_3, 0)) as grade_3,
        SUM(COALESCE(sp.grade_4, 0)) as grade_4,
        SUM(COALESCE(sp.grade_5, 0)) as grade_5,
        SUM(COALESCE(sp.grade_6, 0)) as grade_6,
        SUM(COALESCE(sp.grade_7, 0)) as grade_7,
        SUM(COALESCE(sp.grade_8, 0)) as grade_8,
        SUM(COALESCE(sp.grade_9, 0)) as grade_9,
        SUM(COALESCE(sp.grade_10, 0)) as grade_10,
        SUM(COALESCE(sp.grade_11, 0)) as grade_11,
        SUM(COALESCE(sp.grade_12, 0)) as grade_12,

        SUM(COALESCE(sp.classes_kinder, 0)) as classes_kinder,
        SUM(COALESCE(sp.classes_grade_1, 0)) as classes_grade_1,
        SUM(COALESCE(sp.classes_grade_2, 0)) as classes_grade_2,
        SUM(COALESCE(sp.classes_grade_3, 0)) as classes_grade_3,
        SUM(COALESCE(sp.classes_grade_4, 0)) as classes_grade_4,
        SUM(COALESCE(sp.classes_grade_5, 0)) as classes_grade_5,
        SUM(COALESCE(sp.classes_grade_6, 0)) as classes_grade_6,
        SUM(COALESCE(sp.classes_grade_7, 0)) as classes_grade_7,
        SUM(COALESCE(sp.classes_grade_8, 0)) as classes_grade_8,
        SUM(COALESCE(sp.classes_grade_9, 0)) as classes_grade_9,
        SUM(COALESCE(sp.classes_grade_10, 0)) as classes_grade_10,
        SUM(COALESCE(sp.classes_grade_11, 0)) as classes_grade_11,
        SUM(COALESCE(sp.classes_grade_12, 0)) as classes_grade_12,
        
        SUM(COALESCE(sp.aral_math_g1, 0)) as aral_math_g1,
        SUM(COALESCE(sp.aral_read_g1, 0)) as aral_read_g1,
        SUM(COALESCE(sp.aral_sci_g1, 0)) as aral_sci_g1,
        SUM(COALESCE(sp.aral_math_g2, 0)) as aral_math_g2,
        SUM(COALESCE(sp.aral_read_g2, 0)) as aral_read_g2,
        SUM(COALESCE(sp.aral_sci_g2, 0)) as aral_sci_g2,
        SUM(COALESCE(sp.aral_math_g3, 0)) as aral_math_g3,
        SUM(COALESCE(sp.aral_read_g3, 0)) as aral_read_g3,
        SUM(COALESCE(sp.aral_sci_g3, 0)) as aral_sci_g3,
        SUM(COALESCE(sp.aral_math_g4, 0)) as aral_math_g4,
        SUM(COALESCE(sp.aral_read_g4, 0)) as aral_read_g4,
        SUM(COALESCE(sp.aral_sci_g4, 0)) as aral_sci_g4,
        SUM(COALESCE(sp.aral_math_g5, 0)) as aral_math_g5,
        SUM(COALESCE(sp.aral_read_g5, 0)) as aral_read_g5,
        SUM(COALESCE(sp.aral_sci_g5, 0)) as aral_sci_g5,
        SUM(COALESCE(sp.aral_math_g6, 0)) as aral_math_g6,
        SUM(COALESCE(sp.aral_read_g6, 0)) as aral_read_g6,
        SUM(COALESCE(sp.aral_sci_g6, 0)) as aral_sci_g6,

        SUM(COALESCE(sp.cnt_less_kinder, 0)) as cnt_less_kinder,
        SUM(COALESCE(sp.cnt_within_kinder, 0)) as cnt_within_kinder,
        SUM(COALESCE(sp.cnt_above_kinder, 0)) as cnt_above_kinder,
        
        SUM(COALESCE(sp.cnt_less_g1, 0)) as cnt_less_g1,
        SUM(COALESCE(sp.cnt_within_g1, 0)) as cnt_within_g1,
        SUM(COALESCE(sp.cnt_above_g1, 0)) as cnt_above_g1,
        
        SUM(COALESCE(sp.cnt_less_g2, 0)) as cnt_less_g2,
        SUM(COALESCE(sp.cnt_within_g2, 0)) as cnt_within_g2,
        SUM(COALESCE(sp.cnt_above_g2, 0)) as cnt_above_g2,
        
        SUM(COALESCE(sp.cnt_less_g3, 0)) as cnt_less_g3,
        SUM(COALESCE(sp.cnt_within_g3, 0)) as cnt_within_g3,
        SUM(COALESCE(sp.cnt_above_g3, 0)) as cnt_above_g3,
        
        SUM(COALESCE(sp.cnt_less_g4, 0)) as cnt_less_g4,
        SUM(COALESCE(sp.cnt_within_g4, 0)) as cnt_within_g4,
        SUM(COALESCE(sp.cnt_above_g4, 0)) as cnt_above_g4,
        
        SUM(COALESCE(sp.cnt_less_g5, 0)) as cnt_less_g5,
        SUM(COALESCE(sp.cnt_within_g5, 0)) as cnt_within_g5,
        SUM(COALESCE(sp.cnt_above_g5, 0)) as cnt_above_g5,
        
        SUM(COALESCE(sp.cnt_less_g6, 0)) as cnt_less_g6,
        SUM(COALESCE(sp.cnt_within_g6, 0)) as cnt_within_g6,
        SUM(COALESCE(sp.cnt_above_g6, 0)) as cnt_above_g6,
        
        SUM(COALESCE(sp.cnt_less_g7, 0)) as cnt_less_g7,
        SUM(COALESCE(sp.cnt_within_g7, 0)) as cnt_within_g7,
        SUM(COALESCE(sp.cnt_above_g7, 0)) as cnt_above_g7,
        
        SUM(COALESCE(sp.cnt_less_g8, 0)) as cnt_less_g8,
        SUM(COALESCE(sp.cnt_within_g8, 0)) as cnt_within_g8,
        SUM(COALESCE(sp.cnt_above_g8, 0)) as cnt_above_g8,
        
        SUM(COALESCE(sp.cnt_less_g9, 0)) as cnt_less_g9,
        SUM(COALESCE(sp.cnt_within_g9, 0)) as cnt_within_g9,
        SUM(COALESCE(sp.cnt_above_g9, 0)) as cnt_above_g9,
        
        SUM(COALESCE(sp.cnt_less_g10, 0)) as cnt_less_g10,
        SUM(COALESCE(sp.cnt_within_g10, 0)) as cnt_within_g10,
        SUM(COALESCE(sp.cnt_above_g10, 0)) as cnt_above_g10,
        
        SUM(COALESCE(sp.cnt_less_g11, 0)) as cnt_less_g11,
        SUM(COALESCE(sp.cnt_within_g11, 0)) as cnt_within_g11,
        SUM(COALESCE(sp.cnt_above_g11, 0)) as cnt_above_g11,
        
        SUM(COALESCE(sp.cnt_less_g12, 0)) as cnt_less_g12,
        SUM(COALESCE(sp.cnt_within_g12, 0)) as cnt_within_g12,
        SUM(COALESCE(sp.cnt_above_g12, 0)) as cnt_above_g12,

        -- SNED
        SUM(COALESCE(sp.stat_sned_k, 0)) as stat_sned_k,
        SUM(COALESCE(sp.stat_sned_g1, 0)) as stat_sned_g1,
        SUM(COALESCE(sp.stat_sned_g2, 0)) as stat_sned_g2,
        SUM(COALESCE(sp.stat_sned_g3, 0)) as stat_sned_g3,
        SUM(COALESCE(sp.stat_sned_g4, 0)) as stat_sned_g4,
        SUM(COALESCE(sp.stat_sned_g5, 0)) as stat_sned_g5,
        SUM(COALESCE(sp.stat_sned_g6, 0)) as stat_sned_g6,
        SUM(COALESCE(sp.stat_sned_g7, 0)) as stat_sned_g7,
        SUM(COALESCE(sp.stat_sned_g8, 0)) as stat_sned_g8,
        SUM(COALESCE(sp.stat_sned_g9, 0)) as stat_sned_g9,
        SUM(COALESCE(sp.stat_sned_g10, 0)) as stat_sned_g10,
        SUM(COALESCE(sp.stat_sned_g11, 0)) as stat_sned_g11,
        SUM(COALESCE(sp.stat_sned_g12, 0)) as stat_sned_g12,

        -- DISABILITY
        SUM(COALESCE(sp.stat_disability_k, 0)) as stat_disability_k,
        SUM(COALESCE(sp.stat_disability_g1, 0)) as stat_disability_g1,
        SUM(COALESCE(sp.stat_disability_g2, 0)) as stat_disability_g2,
        SUM(COALESCE(sp.stat_disability_g3, 0)) as stat_disability_g3,
        SUM(COALESCE(sp.stat_disability_g4, 0)) as stat_disability_g4,
        SUM(COALESCE(sp.stat_disability_g5, 0)) as stat_disability_g5,
        SUM(COALESCE(sp.stat_disability_g6, 0)) as stat_disability_g6,
        SUM(COALESCE(sp.stat_disability_g7, 0)) as stat_disability_g7,
        SUM(COALESCE(sp.stat_disability_g8, 0)) as stat_disability_g8,
        SUM(COALESCE(sp.stat_disability_g9, 0)) as stat_disability_g9,
        SUM(COALESCE(sp.stat_disability_g10, 0)) as stat_disability_g10,
        SUM(COALESCE(sp.stat_disability_g11, 0)) as stat_disability_g11,
        SUM(COALESCE(sp.stat_disability_g12, 0)) as stat_disability_g12,

        -- ALS
        SUM(COALESCE(sp.stat_als_k, 0)) as stat_als_k,
        SUM(COALESCE(sp.stat_als_g1, 0)) as stat_als_g1,
        SUM(COALESCE(sp.stat_als_g2, 0)) as stat_als_g2,
        SUM(COALESCE(sp.stat_als_g3, 0)) as stat_als_g3,
        SUM(COALESCE(sp.stat_als_g4, 0)) as stat_als_g4,
        SUM(COALESCE(sp.stat_als_g5, 0)) as stat_als_g5,
        SUM(COALESCE(sp.stat_als_g6, 0)) as stat_als_g6,
        SUM(COALESCE(sp.stat_als_g7, 0)) as stat_als_g7,
        SUM(COALESCE(sp.stat_als_g8, 0)) as stat_als_g8,
        SUM(COALESCE(sp.stat_als_g9, 0)) as stat_als_g9,
        SUM(COALESCE(sp.stat_als_g10, 0)) as stat_als_g10,
        SUM(COALESCE(sp.stat_als_g11, 0)) as stat_als_g11,
        SUM(COALESCE(sp.stat_als_g12, 0)) as stat_als_g12,

        -- MUSLIM
        SUM(COALESCE(sp.stat_muslim_k, 0)) as stat_muslim_k,
        SUM(COALESCE(sp.stat_muslim_g1, 0)) as stat_muslim_g1,
        SUM(COALESCE(sp.stat_muslim_g2, 0)) as stat_muslim_g2,
        SUM(COALESCE(sp.stat_muslim_g3, 0)) as stat_muslim_g3,
        SUM(COALESCE(sp.stat_muslim_g4, 0)) as stat_muslim_g4,
        SUM(COALESCE(sp.stat_muslim_g5, 0)) as stat_muslim_g5,
        SUM(COALESCE(sp.stat_muslim_g6, 0)) as stat_muslim_g6,
        SUM(COALESCE(sp.stat_muslim_g7, 0)) as stat_muslim_g7,
        SUM(COALESCE(sp.stat_muslim_g8, 0)) as stat_muslim_g8,
        SUM(COALESCE(sp.stat_muslim_g9, 0)) as stat_muslim_g9,
        SUM(COALESCE(sp.stat_muslim_g10, 0)) as stat_muslim_g10,
        SUM(COALESCE(sp.stat_muslim_g11, 0)) as stat_muslim_g11,
        SUM(COALESCE(sp.stat_muslim_g12, 0)) as stat_muslim_g12,

        -- IP
        SUM(COALESCE(sp.stat_ip_k, 0)) as stat_ip_k,
        SUM(COALESCE(sp.stat_ip_g1, 0)) as stat_ip_g1,
        SUM(COALESCE(sp.stat_ip_g2, 0)) as stat_ip_g2,
        SUM(COALESCE(sp.stat_ip_g3, 0)) as stat_ip_g3,
        SUM(COALESCE(sp.stat_ip_g4, 0)) as stat_ip_g4,
        SUM(COALESCE(sp.stat_ip_g5, 0)) as stat_ip_g5,
        SUM(COALESCE(sp.stat_ip_g6, 0)) as stat_ip_g6,
        SUM(COALESCE(sp.stat_ip_g7, 0)) as stat_ip_g7,
        SUM(COALESCE(sp.stat_ip_g8, 0)) as stat_ip_g8,
        SUM(COALESCE(sp.stat_ip_g9, 0)) as stat_ip_g9,
        SUM(COALESCE(sp.stat_ip_g10, 0)) as stat_ip_g10,
        SUM(COALESCE(sp.stat_ip_g11, 0)) as stat_ip_g11,
        SUM(COALESCE(sp.stat_ip_g12, 0)) as stat_ip_g12,

        -- DISPLACED
        SUM(COALESCE(sp.stat_displaced_k, 0)) as stat_displaced_k,
        SUM(COALESCE(sp.stat_displaced_g1, 0)) as stat_displaced_g1,
        SUM(COALESCE(sp.stat_displaced_g2, 0)) as stat_displaced_g2,
        SUM(COALESCE(sp.stat_displaced_g3, 0)) as stat_displaced_g3,
        SUM(COALESCE(sp.stat_displaced_g4, 0)) as stat_displaced_g4,
        SUM(COALESCE(sp.stat_displaced_g5, 0)) as stat_displaced_g5,
        SUM(COALESCE(sp.stat_displaced_g6, 0)) as stat_displaced_g6,
        SUM(COALESCE(sp.stat_displaced_g7, 0)) as stat_displaced_g7,
        SUM(COALESCE(sp.stat_displaced_g8, 0)) as stat_displaced_g8,
        SUM(COALESCE(sp.stat_displaced_g9, 0)) as stat_displaced_g9,
        SUM(COALESCE(sp.stat_displaced_g10, 0)) as stat_displaced_g10,
        SUM(COALESCE(sp.stat_displaced_g11, 0)) as stat_displaced_g11,
        SUM(COALESCE(sp.stat_displaced_g12, 0)) as stat_displaced_g12,

        -- REPETITION
        SUM(COALESCE(sp.stat_repetition_k, 0)) as stat_repetition_k,
        SUM(COALESCE(sp.stat_repetition_g1, 0)) as stat_repetition_g1,
        SUM(COALESCE(sp.stat_repetition_g2, 0)) as stat_repetition_g2,
        SUM(COALESCE(sp.stat_repetition_g3, 0)) as stat_repetition_g3,
        SUM(COALESCE(sp.stat_repetition_g4, 0)) as stat_repetition_g4,
        SUM(COALESCE(sp.stat_repetition_g5, 0)) as stat_repetition_g5,
        SUM(COALESCE(sp.stat_repetition_g6, 0)) as stat_repetition_g6,
        SUM(COALESCE(sp.stat_repetition_g7, 0)) as stat_repetition_g7,
        SUM(COALESCE(sp.stat_repetition_g8, 0)) as stat_repetition_g8,
        SUM(COALESCE(sp.stat_repetition_g9, 0)) as stat_repetition_g9,
        SUM(COALESCE(sp.stat_repetition_g10, 0)) as stat_repetition_g10,
        SUM(COALESCE(sp.stat_repetition_g11, 0)) as stat_repetition_g11,
        SUM(COALESCE(sp.stat_repetition_g12, 0)) as stat_repetition_g12,

        -- OVERAGE
        SUM(COALESCE(sp.stat_overage_k, 0)) as stat_overage_k,
        SUM(COALESCE(sp.stat_overage_g1, 0)) as stat_overage_g1,
        SUM(COALESCE(sp.stat_overage_g2, 0)) as stat_overage_g2,
        SUM(COALESCE(sp.stat_overage_g3, 0)) as stat_overage_g3,
        SUM(COALESCE(sp.stat_overage_g4, 0)) as stat_overage_g4,
        SUM(COALESCE(sp.stat_overage_g5, 0)) as stat_overage_g5,
        SUM(COALESCE(sp.stat_overage_g6, 0)) as stat_overage_g6,
        SUM(COALESCE(sp.stat_overage_g7, 0)) as stat_overage_g7,
        SUM(COALESCE(sp.stat_overage_g8, 0)) as stat_overage_g8,
        SUM(COALESCE(sp.stat_overage_g9, 0)) as stat_overage_g9,
        SUM(COALESCE(sp.stat_overage_g10, 0)) as stat_overage_g10,
        SUM(COALESCE(sp.stat_overage_g11, 0)) as stat_overage_g11,
        SUM(COALESCE(sp.stat_overage_g12, 0)) as stat_overage_g12,

        -- DROPOUT
        SUM(COALESCE(sp.stat_dropout_k, 0)) as stat_dropout_k,
        SUM(COALESCE(sp.stat_dropout_g1, 0)) as stat_dropout_g1,
        SUM(COALESCE(sp.stat_dropout_g2, 0)) as stat_dropout_g2,
        SUM(COALESCE(sp.stat_dropout_g3, 0)) as stat_dropout_g3,
        SUM(COALESCE(sp.stat_dropout_g4, 0)) as stat_dropout_g4,
        SUM(COALESCE(sp.stat_dropout_g5, 0)) as stat_dropout_g5,
        SUM(COALESCE(sp.stat_dropout_g6, 0)) as stat_dropout_g6,
        SUM(COALESCE(sp.stat_dropout_g7, 0)) as stat_dropout_g7,
        SUM(COALESCE(sp.stat_dropout_g8, 0)) as stat_dropout_g8,
        SUM(COALESCE(sp.stat_dropout_g9, 0)) as stat_dropout_g9,
        SUM(COALESCE(sp.stat_dropout_g10, 0)) as stat_dropout_g10,
        SUM(COALESCE(sp.stat_dropout_g11, 0)) as stat_dropout_g11,
        SUM(COALESCE(sp.stat_dropout_g12, 0)) as stat_dropout_g12,

        -- SHIFTING METRICS
        SUM(CASE WHEN sp.shift_kinder = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_k,
        SUM(CASE WHEN sp.shift_kinder = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_k,
        SUM(CASE WHEN sp.shift_kinder = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_k,
        SUM(CASE WHEN sp.shift_g1 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g1,
        SUM(CASE WHEN sp.shift_g1 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g1,
        SUM(CASE WHEN sp.shift_g1 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g1,
        SUM(CASE WHEN sp.shift_g2 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g2,
        SUM(CASE WHEN sp.shift_g2 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g2,
        SUM(CASE WHEN sp.shift_g2 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g2,
        SUM(CASE WHEN sp.shift_g3 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g3,
        SUM(CASE WHEN sp.shift_g3 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g3,
        SUM(CASE WHEN sp.shift_g3 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g3,
        SUM(CASE WHEN sp.shift_g4 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g4,
        SUM(CASE WHEN sp.shift_g4 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g4,
        SUM(CASE WHEN sp.shift_g4 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g4,
        SUM(CASE WHEN sp.shift_g5 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g5,
        SUM(CASE WHEN sp.shift_g5 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g5,
        SUM(CASE WHEN sp.shift_g5 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g5,
        SUM(CASE WHEN sp.shift_g6 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g6,
        SUM(CASE WHEN sp.shift_g6 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g6,
        SUM(CASE WHEN sp.shift_g6 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g6,
        SUM(CASE WHEN sp.shift_g7 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g7,
        SUM(CASE WHEN sp.shift_g7 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g7,
        SUM(CASE WHEN sp.shift_g7 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g7,
        SUM(CASE WHEN sp.shift_g8 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g8,
        SUM(CASE WHEN sp.shift_g8 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g8,
        SUM(CASE WHEN sp.shift_g8 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g8,
        SUM(CASE WHEN sp.shift_g9 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g9,
        SUM(CASE WHEN sp.shift_g9 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g9,
        SUM(CASE WHEN sp.shift_g9 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g9,
        SUM(CASE WHEN sp.shift_g10 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g10,
        SUM(CASE WHEN sp.shift_g10 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g10,
        SUM(CASE WHEN sp.shift_g10 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g10,
        SUM(CASE WHEN sp.shift_g11 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g11,
        SUM(CASE WHEN sp.shift_g11 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g11,
        SUM(CASE WHEN sp.shift_g11 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g11,
        SUM(CASE WHEN sp.shift_g12 = 'Single Shift' THEN 1 ELSE 0 END) as cnt_shift_single_g12,
        SUM(CASE WHEN sp.shift_g12 = 'Double Shift' THEN 1 ELSE 0 END) as cnt_shift_double_g12,
        SUM(CASE WHEN sp.shift_g12 = 'Triple Shift' THEN 1 ELSE 0 END) as cnt_shift_triple_g12,

        -- LEARNING DELIVERY METRICS
        SUM(CASE WHEN sp.mode_kinder = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_k,
        SUM(CASE WHEN sp.mode_kinder LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_k,
        SUM(CASE WHEN sp.mode_kinder = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_k,
        SUM(CASE WHEN sp.mode_g1 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g1,
        SUM(CASE WHEN sp.mode_g1 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g1,
        SUM(CASE WHEN sp.mode_g1 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g1,
        SUM(CASE WHEN sp.mode_g2 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g2,
        SUM(CASE WHEN sp.mode_g2 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g2,
        SUM(CASE WHEN sp.mode_g2 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g2,
        SUM(CASE WHEN sp.mode_g3 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g3,
        SUM(CASE WHEN sp.mode_g3 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g3,
        SUM(CASE WHEN sp.mode_g3 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g3,
        SUM(CASE WHEN sp.mode_g4 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g4,
        SUM(CASE WHEN sp.mode_g4 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g4,
        SUM(CASE WHEN sp.mode_g4 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g4,
        SUM(CASE WHEN sp.mode_g5 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g5,
        SUM(CASE WHEN sp.mode_g5 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g5,
        SUM(CASE WHEN sp.mode_g5 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g5,
        SUM(CASE WHEN sp.mode_g6 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g6,
        SUM(CASE WHEN sp.mode_g6 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g6,
        SUM(CASE WHEN sp.mode_g6 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g6,
        SUM(CASE WHEN sp.mode_g7 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g7,
        SUM(CASE WHEN sp.mode_g7 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g7,
        SUM(CASE WHEN sp.mode_g7 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g7,
        SUM(CASE WHEN sp.mode_g8 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g8,
        SUM(CASE WHEN sp.mode_g8 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g8,
        SUM(CASE WHEN sp.mode_g8 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g8,
        SUM(CASE WHEN sp.mode_g9 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g9,
        SUM(CASE WHEN sp.mode_g9 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g9,
        SUM(CASE WHEN sp.mode_g9 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g9,
        SUM(CASE WHEN sp.mode_g10 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g10,
        SUM(CASE WHEN sp.mode_g10 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g10,
        SUM(CASE WHEN sp.mode_g10 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g10,
        SUM(CASE WHEN sp.mode_g11 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g11,
        SUM(CASE WHEN sp.mode_g11 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g11,
        SUM(CASE WHEN sp.mode_g11 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g11,
        SUM(CASE WHEN sp.mode_g12 = 'In-Person Classes' THEN 1 ELSE 0 END) as cnt_mode_inperson_g12,
        SUM(CASE WHEN sp.mode_g12 LIKE '%Blended%' THEN 1 ELSE 0 END) as cnt_mode_blended_g12,
        SUM(CASE WHEN sp.mode_g12 = 'Full Distance Learning' THEN 1 ELSE 0 END) as cnt_mode_distance_g12,

        -- EMERGENCY ADM METRICS
        SUM(CASE WHEN sp.adm_mdl IS TRUE THEN 1 ELSE 0 END) as cnt_adm_mdl,
        SUM(CASE WHEN sp.adm_odl IS TRUE THEN 1 ELSE 0 END) as cnt_adm_odl,
        SUM(CASE WHEN sp.adm_tvi IS TRUE THEN 1 ELSE 0 END) as cnt_adm_tvi,
        SUM(CASE WHEN sp.adm_blended IS TRUE THEN 1 ELSE 0 END) as cnt_adm_blended,

        -- TEACHER METRICS (COUNT BY GRADE/LEVEL)
        SUM(sp.teach_kinder) as cnt_teach_k,
        SUM(sp.teach_g1) as cnt_teach_g1,
        SUM(sp.teach_g2) as cnt_teach_g2,
        SUM(sp.teach_g3) as cnt_teach_g3,
        SUM(sp.teach_g4) as cnt_teach_g4,
        SUM(sp.teach_g5) as cnt_teach_g5,
        SUM(sp.teach_g6) as cnt_teach_g6,
        SUM(sp.teach_g7) as cnt_teach_g7,
        SUM(sp.teach_g8) as cnt_teach_g8,
        SUM(sp.teach_g9) as cnt_teach_g9,
        SUM(sp.teach_g10) as cnt_teach_g10,
        SUM(sp.teach_g11) as cnt_teach_g11,
        SUM(sp.teach_g12) as cnt_teach_g12,

        -- MULTIGRADE TEACHERS
        SUM(sp.teach_multi_1_2) as cnt_multi_1_2,
        SUM(sp.teach_multi_3_4) as cnt_multi_3_4,
        SUM(sp.teach_multi_5_6) as cnt_multi_5_6,

        -- TEACHING EXPERIENCE
        SUM(sp.teach_exp_0_1) as cnt_exp_0_1,
        SUM(sp.teach_exp_2_5) as cnt_exp_2_5,
        SUM(sp.teach_exp_6_10) as cnt_exp_6_10,
        SUM(sp.teach_exp_11_15) as cnt_exp_11_15,
        SUM(sp.teach_exp_16_20) as cnt_exp_16_20,
        SUM(sp.teach_exp_21_25) as cnt_exp_21_25,
        SUM(sp.teach_exp_26_30) as cnt_exp_26_30,
        SUM(sp.teach_exp_31_35) as cnt_exp_31_35,
        SUM(sp.teach_exp_36_40) as cnt_exp_36_40,
        SUM(sp.teach_exp_40_45) as cnt_exp_40_45,

        -- SPECIALIZATION (MAJORS)
        SUM(sp.spec_math_major) as cnt_spec_math,
        SUM(sp.spec_science_major) as cnt_spec_sci,
        SUM(sp.spec_english_major) as cnt_spec_eng,
        SUM(sp.spec_filipino_major) as cnt_spec_fil,
        SUM(sp.spec_ap_major) as cnt_spec_ap,
        SUM(sp.spec_mapeh_major) as cnt_spec_mapeh,
        SUM(sp.spec_esp_major) as cnt_spec_esp,
        SUM(sp.spec_tle_major) as cnt_spec_tle,
        SUM(sp.spec_general_major) as cnt_spec_gen,
        SUM(sp.spec_ece_major) as cnt_spec_ece,

        -- CLASSROOMS (Condition)
        SUM(sp.build_classrooms_new) as cnt_class_new,
        SUM(sp.build_classrooms_good) as cnt_class_good,
        SUM(sp.build_classrooms_repair) as cnt_class_repair,
        SUM(sp.build_classrooms_demolition) as cnt_class_demolish,

        -- EQUIPMENT & INVENTORY
        SUM(sp.res_ecart_func) as cnt_equip_ecart_func,
        SUM(sp.res_ecart_nonfunc) as cnt_equip_ecart_non,
        SUM(sp.res_laptop_func) as cnt_equip_laptop_func,
        SUM(sp.res_laptop_nonfunc) as cnt_equip_laptop_non,
        SUM(sp.res_printer_func) as cnt_equip_printer_func,
        SUM(sp.res_printer_nonfunc) as cnt_equip_printer_non,
        SUM(sp.res_tv_func) as cnt_equip_tv_func,
        SUM(sp.res_tv_nonfunc) as cnt_equip_tv_non,

        -- SEATS (By Grade)
        SUM(sp.seats_kinder) as cnt_seats_k,
        SUM(sp.seats_grade_1) as cnt_seats_g1,
        SUM(sp.seats_grade_2) as cnt_seats_g2,
        SUM(sp.seats_grade_3) as cnt_seats_g3,
        SUM(sp.seats_grade_4) as cnt_seats_g4,
        SUM(sp.seats_grade_5) as cnt_seats_g5,
        SUM(sp.seats_grade_6) as cnt_seats_g6,
        SUM(sp.seats_grade_7) as cnt_seats_g7,
        SUM(sp.seats_grade_8) as cnt_seats_g8,
        SUM(sp.seats_grade_9) as cnt_seats_g9,
        SUM(sp.seats_grade_10) as cnt_seats_g10,
        SUM(sp.seats_grade_11) as cnt_seats_g11,
        SUM(sp.seats_grade_12) as cnt_seats_g12,

        -- TOILETS (Comfort Rooms)
        SUM(sp.res_toilets_male) as cnt_toilet_male,
        SUM(sp.res_toilets_female) as cnt_toilet_female,
        SUM(sp.res_toilets_pwd) as cnt_toilet_pwd,
        SUM(sp.res_toilets_common) as cnt_toilet_common,

        -- SPECIALIZED ROOMS
        SUM(sp.res_sci_labs) as cnt_room_sci,
        SUM(sp.res_com_labs) as cnt_room_com,
        SUM(sp.res_tvl_workshops) as cnt_room_tvl,

        -- SITE & UTILITIES
        -- Electricity
        SUM(CASE WHEN sp.res_electricity_source = 'GRID SUPPLY' THEN 1 ELSE 0 END) as cnt_site_elec_grid,
        SUM(CASE WHEN sp.res_electricity_source LIKE '%OFF-GRID%' THEN 1 ELSE 0 END) as cnt_site_elec_offgrid,
        SUM(CASE WHEN sp.res_electricity_source = 'NO ELECTRICITY' THEN 1 ELSE 0 END) as cnt_site_elec_none,
        
        -- Water
        SUM(CASE WHEN sp.res_water_source LIKE '%Piped%' THEN 1 ELSE 0 END) as cnt_site_water_piped,
        SUM(CASE WHEN sp.res_water_source = 'Natural Resources' THEN 1 ELSE 0 END) as cnt_site_water_natural,
        SUM(CASE WHEN sp.res_water_source = 'No Water Source' THEN 1 ELSE 0 END) as cnt_site_water_none,

        -- Buildable Space
        SUM(CASE WHEN sp.res_buildable_space = 'Yes' THEN 1 ELSE 0 END) as cnt_site_build_yes,
        SUM(CASE WHEN sp.res_buildable_space = 'No' THEN 1 ELSE 0 END) as cnt_site_build_no,

        -- SHA (Hardship)
        SUM(CASE WHEN sp.sha_category LIKE '%HARDSHIP%' THEN 1 ELSE 0 END) as cnt_site_sha_hardship,
        SUM(CASE WHEN sp.sha_category LIKE '%MULTIGRADE%' THEN 1 ELSE 0 END) as cnt_site_sha_multi,


        -- HIERARCHICAL AGGREGATES
        
        -- SNED (Sum of Levels - Calculated from grades as requested)
        SUM(
            COALESCE(sp.stat_sned_k, 0) + 
            COALESCE(sp.stat_sned_g1, 0) + COALESCE(sp.stat_sned_g2, 0) + COALESCE(sp.stat_sned_g3, 0) + 
            COALESCE(sp.stat_sned_g4, 0) + COALESCE(sp.stat_sned_g5, 0) + COALESCE(sp.stat_sned_g6, 0)
        ) as stat_sned_es,
        
        SUM(
            COALESCE(sp.stat_sned_g7, 0) + COALESCE(sp.stat_sned_g8, 0) + 
            COALESCE(sp.stat_sned_g9, 0) + COALESCE(sp.stat_sned_g10, 0)
        ) as stat_sned_jhs,
        
        SUM(COALESCE(sp.stat_sned_g11, 0) + COALESCE(sp.stat_sned_g12, 0)) as stat_sned_shs,
        
        SUM(
            COALESCE(sp.stat_sned_k, 0) + 
            COALESCE(sp.stat_sned_g1, 0) + COALESCE(sp.stat_sned_g2, 0) + COALESCE(sp.stat_sned_g3, 0) + 
            COALESCE(sp.stat_sned_g4, 0) + COALESCE(sp.stat_sned_g5, 0) + COALESCE(sp.stat_sned_g6, 0) + 
            COALESCE(sp.stat_sned_g7, 0) + COALESCE(sp.stat_sned_g8, 0) + COALESCE(sp.stat_sned_g9, 0) + 
            COALESCE(sp.stat_sned_g10, 0) + COALESCE(sp.stat_sned_g11, 0) + COALESCE(sp.stat_sned_g12, 0)
        ) as stat_sned_total,

        -- DISABILITY (Sum of Levels)
        SUM(COALESCE(sp.stat_disability_es, 0)) as stat_disability_es,
        SUM(COALESCE(sp.stat_disability_jhs, 0)) as stat_disability_jhs,
        SUM(COALESCE(sp.stat_disability_shs, 0)) as stat_disability_shs,
        SUM(COALESCE(sp.stat_disability_es, 0) + COALESCE(sp.stat_disability_jhs, 0) + COALESCE(sp.stat_disability_shs, 0)) as stat_disability_total,

        -- ALS (Sum of Levels)
        SUM(COALESCE(sp.stat_als_es, 0)) as stat_als_es,
        SUM(COALESCE(sp.stat_als_jhs, 0)) as stat_als_jhs,
        SUM(COALESCE(sp.stat_als_shs, 0)) as stat_als_shs,
        SUM(COALESCE(sp.stat_als_es, 0) + COALESCE(sp.stat_als_jhs, 0) + COALESCE(sp.stat_als_shs, 0)) as stat_als_total,

        -- MUSLIM (Sum of Grades, as aggregates missing)
        SUM(
            COALESCE(sp.stat_muslim_k, 0) + COALESCE(sp.stat_muslim_g1, 0) + COALESCE(sp.stat_muslim_g2, 0) + 
            COALESCE(sp.stat_muslim_g3, 0) + COALESCE(sp.stat_muslim_g4, 0) + COALESCE(sp.stat_muslim_g5, 0) + 
            COALESCE(sp.stat_muslim_g6, 0)
        ) as stat_muslim_es,
        SUM(
            COALESCE(sp.stat_muslim_g7, 0) + COALESCE(sp.stat_muslim_g8, 0) + COALESCE(sp.stat_muslim_g9, 0) + 
            COALESCE(sp.stat_muslim_g10, 0)
        ) as stat_muslim_jhs,
        SUM(COALESCE(sp.stat_muslim_g11, 0) + COALESCE(sp.stat_muslim_g12, 0)) as stat_muslim_shs,
        SUM(
            COALESCE(sp.stat_muslim_k, 0) + COALESCE(sp.stat_muslim_g1, 0) + COALESCE(sp.stat_muslim_g2, 0) + 
            COALESCE(sp.stat_muslim_g3, 0) + COALESCE(sp.stat_muslim_g4, 0) + COALESCE(sp.stat_muslim_g5, 0) + 
            COALESCE(sp.stat_muslim_g6, 0) + COALESCE(sp.stat_muslim_g7, 0) + COALESCE(sp.stat_muslim_g8, 0) + 
            COALESCE(sp.stat_muslim_g9, 0) + COALESCE(sp.stat_muslim_g10, 0) + COALESCE(sp.stat_muslim_g11, 0) + 
            COALESCE(sp.stat_muslim_g12, 0)
        ) as stat_muslim_total,

        -- IP (Existing Total)
        SUM(COALESCE(sp.stat_ip_es, 0)) as stat_ip_es,
        SUM(COALESCE(sp.stat_ip_jhs, 0)) as stat_ip_jhs,
        SUM(COALESCE(sp.stat_ip_shs, 0)) as stat_ip_shs,
        SUM(COALESCE(sp.stat_ip, 0)) as stat_ip_total,

        -- DISPLACED (Existing Total)
        SUM(COALESCE(sp.stat_displaced_es, 0)) as stat_displaced_es,
        SUM(COALESCE(sp.stat_displaced_jhs, 0)) as stat_displaced_jhs,
        SUM(COALESCE(sp.stat_displaced_shs, 0)) as stat_displaced_shs,
        SUM(COALESCE(sp.stat_displaced, 0)) as stat_displaced_total,

        -- REPETITION (Existing Total)
        SUM(COALESCE(sp.stat_repetition_es, 0)) as stat_repetition_es,
        SUM(COALESCE(sp.stat_repetition_jhs, 0)) as stat_repetition_jhs,
        SUM(COALESCE(sp.stat_repetition_shs, 0)) as stat_repetition_shs,
        SUM(COALESCE(sp.stat_repetition, 0)) as stat_repetition_total,

        -- OVERAGE (Existing Total)
        SUM(COALESCE(sp.stat_overage_es, 0)) as stat_overage_es,
        SUM(COALESCE(sp.stat_overage_jhs, 0)) as stat_overage_jhs,
        SUM(COALESCE(sp.stat_overage_shs, 0)) as stat_overage_shs,
        SUM(COALESCE(sp.stat_overage, 0)) as stat_overage_total,

        -- DROPOUT (Sum of Levels, missing Total)
        SUM(COALESCE(sp.stat_dropout_es, 0)) as stat_dropout_es,
        SUM(COALESCE(sp.stat_dropout_jhs, 0)) as stat_dropout_jhs,
        SUM(COALESCE(sp.stat_dropout_shs, 0)) as stat_dropout_shs,
        SUM(COALESCE(sp.stat_dropout_es, 0) + COALESCE(sp.stat_dropout_jhs, 0) + COALESCE(sp.stat_dropout_shs, 0)) as stat_dropout_total
      FROM schools s
      LEFT JOIN school_profiles sp ON s.school_id = sp.school_id
      LEFT JOIN school_summary ss ON s.school_id = ss.school_id
      WHERE TRIM(s.region) = TRIM($1) AND TRIM(s.division) = TRIM($2)
      GROUP BY ${groupCol}
      ORDER BY ${groupCol} ASC
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
      sp.*,
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


// --- TEMPORARY MIGRATION ENDPOINT (FACILITY REPAIRS) ---
// --- MIGRATE REPAIR DETAILS SCHEMA ---
app.get('/api/migrate-repair-details', async (req, res) => {
  try {
    const client = await pool.connect();
    const results = [];

    // 1. Drop old table
    try {
      await client.query('DROP TABLE IF EXISTS facility_repairs');
      results.push("Dropped old facility_repairs table");
    } catch (e) { results.push(`Failed drop: ${e.message}`); }

    // 2. Create new table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS facility_repair_details (
          id SERIAL PRIMARY KEY,
          school_id VARCHAR(50), -- Added explicitly for consistency
          iern VARCHAR(50),
          building_no VARCHAR(100),
          room_no VARCHAR(100),
          item_name VARCHAR(100),
          oms TEXT,
          condition VARCHAR(50),
          damage_ratio INTEGER,
          recommended_action VARCHAR(100),
          demo_justification TEXT,
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Add indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_frd_iern ON facility_repair_details(iern)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_frd_school_id ON facility_repair_details(school_id)');

      results.push("Created facility_repair_details table");
    } catch (e) { results.push(`Failed create: ${e.message}`); }

    client.release();
    res.json({ message: "Repair Details Migration finished", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
// --- TEMPORARY MIGRATION ENDPOINT (LGU FIELDS) ---
app.get('/api/migrate-lgu-schema', async (req, res) => {
  try {
    const client = await pool.connect();
    const results = [];
    const table = 'lgu_forms';

    const columns = [
      { name: 'source_agency', type: 'TEXT' },
      { name: 'lsb_resolution_no', type: 'TEXT' },
      { name: 'moa_ref_no', type: 'TEXT' },
      { name: 'validity_period', type: 'TEXT' },
      { name: 'contract_duration', type: 'TEXT' },
      { name: 'date_approved_pow', type: 'DATE' },
      { name: 'fund_release_schedule', type: 'TEXT' },
      { name: 'mode_of_procurement', type: 'TEXT' },
      { name: 'philgeps_ref_no', type: 'TEXT' },
      { name: 'pcab_license_no', type: 'TEXT' },
      { name: 'date_contract_signing', type: 'DATE' },
      { name: 'bid_amount', type: 'NUMERIC' },
      { name: 'nature_of_delay', type: 'TEXT' },
      { name: 'date_notice_of_award', type: 'DATE' }
    ];

    for (const col of columns) {
      try {
        await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        results.push(`Added ${col.name}`);
      } catch (e) {
        results.push(`Failed ${col.name}: ${e.message}`);
      }
    }

    client.release();
    res.json({ message: "LGU Migration attempt finished", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TEMPORARY MIGRATION ENDPOINT (LGU IMAGES) ---
app.get('/api/migrate-lgu-image-schema', async (req, res) => {
  try {
    const client = await pool.connect();
    const results = [];


    // Add category column to lgu_image
    try {
      await client.query('ALTER TABLE "lgu_image" ADD COLUMN IF NOT EXISTS category TEXT');
      results.push("Added category to lgu_image");
    } catch (e) { results.push(`Failed category: ${e.message}`); }

    client.release();
    res.json({ message: "LGU Image Migration attempt finished", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TEMPORARY MIGRATION ENDPOINT (SPECIAL ORDER) ---
app.get('/api/migrate-special-order-schema', async (req, res) => {
  try {
    const client = await pool.connect();
    const results = [];

    // 1. Add special_order to pending_schools
    try {
      await client.query('ALTER TABLE "pending_schools" ADD COLUMN IF NOT EXISTS special_order TEXT');
      results.push("Added special_order to pending_schools");
    } catch (e) { results.push(`Failed pending_schools: ${e.message}`); }

    // 2. Add special_order to schools
    try {
      await client.query('ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS special_order TEXT');
      results.push("Added special_order to schools");
    } catch (e) { results.push(`Failed schools: ${e.message}`); }

    client.release();
    res.json({ message: "Special Order Migration attempt finished", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
      parseNumberOrNull(data.funds_utilized), // 41

      // NEW FIELDS
      valueOrNull(data.source_agency), // 42
      valueOrNull(data.lsb_resolution_no), // 43
      valueOrNull(data.moa_ref_no), // 44
      valueOrNull(data.validity_period), // 45
      valueOrNull(data.contract_duration), // 46
      valueOrNull(data.date_approved_pow), // 47
      valueOrNull(data.fund_release_schedule), // 48
      valueOrNull(data.mode_of_procurement), // 49
      valueOrNull(data.philgeps_ref_no), // 50
      valueOrNull(data.pcab_license_no), // 51
      valueOrNull(data.date_contract_signing), // 52
      parseNumberOrNull(data.bid_amount), // 53
      valueOrNull(data.nature_of_delay), // 54
      valueOrNull(data.date_notice_of_award) // 55
    ];

    const projectQuery = `
      INSERT INTO "lgu_forms" (
        project_name, school_name, school_id, region, division,
        status, accomplishment_percentage, status_as_of,
        target_completion_date, actual_completion_date, notice_to_proceed,
        contractor_name, project_allocation, batch_of_funds, other_remarks,
        lgu_id, ipc, lgu_name, latitude, longitude,
        pow_pdf, dupa_pdf, contract_pdf,
        -- EXISTING NEW COLUMNS
        moa_date, tranches_count, tranche_amount, fund_source,
        province, city, municipality, legislative_district,
        scope_of_works, contract_amount, bid_opening_date,
        resolution_award_date, procurement_stage, bidding_date,
        awarding_date, construction_start_date, funds_downloaded,
        funds_utilized,
        -- NEWEST COLUMNS
        source_agency, lsb_resolution_no, moa_ref_no, validity_period,
        contract_duration, date_approved_pow, fund_release_schedule,
        mode_of_procurement, philgeps_ref_no, pcab_license_no,
        date_contract_signing, bid_amount, nature_of_delay, date_notice_of_award
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55
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

// --- FINANCE 1. GET: Fetch All Projects (Latest Version) ---
app.get('/api/finance/projects', async (req, res) => {
  try {
    // DISTINCT ON (root_id) requires ORDER BY root_id, then other fields
    const result = await pool.query(`
        SELECT DISTINCT ON (root_id) * 
        FROM finance_projects 
        WHERE root_id IS NOT NULL
        ORDER BY root_id, created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching finance projects:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// --- FINANCE 2. POST: Create Project ---
app.post('/api/finance/projects', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      school_id, school_name, project_name, region, division, municipality, district, legislative_district,
      total_funds, fund_released, date_of_release
    } = req.body;

    await client.query('BEGIN');

    // 1. Insert into Finance Table (Initial)
    const insertQuery = `
        INSERT INTO finance_projects (
            school_id, school_name, project_name, region, division, municipality, district, legislative_district,
            total_funds, fund_released, date_of_release
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING finance_id, *;
    `;

    // Clean numbers
    const cleanTotal = total_funds ? parseFloat(total_funds.toString().replace(/,/g, '')) : 0;
    const cleanReleased = fund_released ? parseFloat(fund_released.toString().replace(/,/g, '')) : 0;
    // Clean Date
    let cleanDate = date_of_release;
    if (date_of_release === '' || date_of_release === null) cleanDate = null;

    const result = await client.query(insertQuery, [
      school_id, school_name, project_name, region, division, municipality, district, legislative_district,
      cleanTotal, cleanReleased, cleanDate
    ]);

    let newProject = result.rows[0];
    const newId = newProject.finance_id;
    const rootId = `FIN-${newId}`;

    // 2. Set root_id for this first record
    await client.query('UPDATE finance_projects SET root_id = $1 WHERE finance_id = $2', [rootId, newId]);
    newProject.root_id = rootId;

    // 3. Auto-Create LGU Project (Sync) using the same Root ID
    const lguQuery = `
        INSERT INTO lgu_projects (
            root_project_id, 
            school_id, school_name, project_name, region, division, municipality, district, legislative_district,
            total_funds, fund_released, date_of_release,
            source_agency, project_status, accomplishment_percentage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
    `;

    await client.query(lguQuery, [
      rootId,
      school_id, school_name, project_name, region, division, municipality, district, legislative_district,
      cleanTotal, cleanReleased, cleanDate,
      'Central Office', 'Not Started', 0
    ]);

    await client.query('COMMIT');
    res.json({ success: true, project: newProject });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating finance project:", err);
    res.status(500).json({ error: "Failed to create project" });
  } finally {
    client.release();
  }
});

// --- FINANCE 3. PUT: Update Project (APPEND ONLY) ---
app.put('/api/finance/project/:id', async (req, res) => {
  const { id } = req.params;
  const {
    project_name, total_funds, fund_released, date_of_release
  } = req.body;

  try {
    // 1. Fetch current project to get root_id & other details (to copy over if needed, or just root_id)
    const currentRes = await pool.query('SELECT * FROM finance_projects WHERE finance_id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    const currentProject = currentRes.rows[0];
    const rootId = currentProject.root_id || `FIN-${currentProject.finance_id}`; // Fallback

    // Clean numbers
    const cleanTotal = total_funds ? parseFloat(total_funds.toString().replace(/,/g, '')) : 0;
    const cleanReleased = fund_released ? parseFloat(fund_released.toString().replace(/,/g, '')) : 0;

    // 2. INSERT NEW ROW (Append)
    const query = `
        INSERT INTO finance_projects (
            root_id,
            school_id, school_name, project_name, 
            region, division, municipality, district, legislative_district,
            total_funds, fund_released, date_of_release
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
    `;

    // We copy school/location details from current project as they usually don't change in this edit mode, 
    // or we should accept them from req.body if frontend sends them. 
    // Based on FinanceDashboard, it sends project_name, total_funds, etc. 
    // It implies we should keep the school/location from the original.

    const result = await pool.query(query, [
      rootId,
      currentProject.school_id, currentProject.school_name, project_name || currentProject.project_name,
      currentProject.region, currentProject.division, currentProject.municipality, currentProject.district, currentProject.legislative_district,
      cleanTotal, cleanReleased, date_of_release
    ]);

    res.json({ success: true, project: result.rows[0], message: "Project updated (New Version Created)" });

  } catch (err) {
    console.error("Error updating finance project:", err);
    res.status(500).json({ error: "Failed to update project" });
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

// --- LGU 2b. POST: Upload Project Document (LGU Sequential) ---
app.post('/api/lgu/upload-project-document', async (req, res) => {
  const { projectId, type, base64, uid } = req.body;

  if (!projectId || !type || !base64) return res.status(400).json({ error: "Missing required data" });

  let column = '';
  if (type === 'POW') column = 'pow_pdf';
  else if (type === 'DUPA') column = 'dupa_pdf';
  else if (type === 'CONTRACT') column = 'contract_pdf';
  else return res.status(400).json({ error: "Invalid document type" });

  try {
    const query = `UPDATE lgu_forms SET ${column} = $1 WHERE project_id = $2`;
    await pool.query(query, [base64, projectId]);

    // --- DUAL WRITE ---
    if (poolNew) {
      try {
        const ipcRes = await pool.query('SELECT ipc FROM lgu_forms WHERE project_id = $1', [projectId]);
        if (ipcRes.rows.length > 0) {
          const ipc = ipcRes.rows[0].ipc;
          await poolNew.query(`UPDATE lgu_forms SET ${column} = $1 WHERE ipc = $2`, [base64, ipc]);
          console.log(`✅ Dual-Write LGU: ${type} Synced via IPC!`);
        }
      } catch (dwErr) {
        console.error("❌ Dual-Write LGU Doc Upload Error:", dwErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ LGU Doc Upload Error:", err.message);
    res.status(500).json({ error: "Failed to save document" });
  }
});

// --- LGU 3. GET: Fetch LGU Projects (List) ---
// --- LGU 3. GET: Fetch LGU Projects (LATEST VERSION ONLY) ---
app.get('/api/lgu/projects', async (req, res) => {
  const { uid, municipality } = req.query;
  try {
    // We want the LATEST version for each project.
    // Group by root_project_id and take the one with the latest created_at.
    let query = `
      SELECT DISTINCT ON (root_project_id) *
      FROM lgu_projects
    `;
    const params = [];

    // Filter Logic
    if (uid) {
      const userRes = await pool.query('SELECT role, city FROM users WHERE uid = $1', [uid]);
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        // If user is LGU, filter by municipality (city)
        if (user.city) {
          query += ` WHERE municipality = $1 `;
          params.push(user.city);
        }
      }
    } else if (municipality) {
      query += ` WHERE municipality = $1 `;
      params.push(municipality);
    }

    // IMPORTANT: DISTINCT ON requires the ORDER BY to start with the distinct column
    query += ` ORDER BY root_project_id, created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching LGU projects:", err);
    res.status(500).json({ error: "Failed to fetch LGU projects" });
  }
});

// --- LGU 4. GET: Fetch Single LGU Project Details ---
app.get('/api/lgu/project/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `SELECT * FROM lgu_projects WHERE lgu_project_id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching LGU project details:", err);
    res.status(500).json({ error: "Failed to fetch project details" });
  }
});

// --- LGU 5. POST: Update Project (Append-Only History) ---
app.post('/api/lgu/project/update', async (req, res) => {
  try {
    const project = req.body;

    // We create a NEW record in lgu_projects
    // root_project_id MUST be maintained

    const columns = [
      "region", "division", "district", "legislative_district", "school_id", "school_name",
      "project_name", "total_funds", "fund_released", "date_of_release", "liquidated_amount",
      "liquidation_date", "percentage_liquidated", "source_agency", "contractor_name",
      "lsb_resolution_no", "moa_ref_no", "moa_date", "validity_period", "contract_duration",
      "date_approved_pow", "approved_contract_budget", "schedule_of_fund_release",
      "number_of_tranches", "amount_per_tranche", "mode_of_procurement", "philgeps_ref_no",
      "pcab_license_no", "date_contract_signing", "date_notice_of_award", "bid_amount",
      "latitude", "longitude", "pow_pdf", "dupa_pdf", "contract_pdf",
      "project_status", "accomplishment_percentage", "status_as_of_date",
      "amount_utilized", "nature_of_delay", "root_project_id", "municipality", "other_remarks"
    ];

    const numericCols = [
      "total_funds", "fund_released", "liquidated_amount", "percentage_liquidated",
      "approved_contract_budget", "number_of_tranches", "amount_per_tranche",
      "bid_amount", "accomplishment_percentage", "amount_utilized"
    ];

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const values = columns.map(col => {
      let val = project[col];
      if (val === '' || val === undefined || val === null) return null;

      if (numericCols.includes(col)) {
        if (typeof val === 'string') {
          return parseFloat(val.replace(/,/g, ''));
        }
      }
      return val;
    });

    const query = `
        INSERT INTO lgu_projects (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING lgu_project_id;
    `;

    const result = await pool.query(query, values);

    res.json({ success: true, new_project_id: result.rows[0].lgu_project_id, message: "Project updated (History Saved)" });

  } catch (err) {
    console.error("Error updating LGU project:", err);
    res.status(500).json({ error: "Update failed", details: err.message });
  }
});



// --- LGU 5. PUT: Update LGU Project ---
app.put('/api/lgu/update-project/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  if (!id) return res.status(400).json({ error: "Project ID required" });

  let client;
  let clientNew;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    if (poolNew) {
      try {
        clientNew = await poolNew.connect();
        await clientNew.query('BEGIN');
      } catch (e) { console.error("Dual-write connect error", e); }
    }

    // 1. Update Main Fields
    const updateQuery = `
            UPDATE lgu_forms SET
                project_name = COALESCE($1, project_name),
                school_name = COALESCE($2, school_name),
                school_id = COALESCE($3, school_id),
                status = COALESCE($4, status),
                accomplishment_percentage = COALESCE($5, accomplishment_percentage),
                status_as_of = COALESCE($6, status_as_of),
                target_completion_date = COALESCE($7, target_completion_date),
                actual_completion_date = COALESCE($8, actual_completion_date),
                notice_to_proceed = COALESCE($9, notice_to_proceed),
                contractor_name = COALESCE($10, contractor_name),
                project_allocation = COALESCE($11, project_allocation),
                batch_of_funds = COALESCE($12, batch_of_funds),
                other_remarks = COALESCE($13, other_remarks),
                latitude = COALESCE($14, latitude),
                longitude = COALESCE($15, longitude),
                
                -- NEW FIELDS
                moa_date = COALESCE($16, moa_date),
                tranches_count = COALESCE($17, tranches_count),
                tranche_amount = COALESCE($18, tranche_amount),
                fund_source = COALESCE($19, fund_source),
                scope_of_works = COALESCE($20, scope_of_works),
                contract_amount = COALESCE($21, contract_amount),
                bid_opening_date = COALESCE($22, bid_opening_date),
                resolution_award_date = COALESCE($23, resolution_award_date),
                procurement_stage = COALESCE($24, procurement_stage),
                bidding_date = COALESCE($25, bidding_date),
                awarding_date = COALESCE($26, awarding_date),
                construction_start_date = COALESCE($27, construction_start_date),
                funds_downloaded = COALESCE($28, funds_downloaded),
                funds_utilized = COALESCE($29, funds_utilized),

                -- NEWEST FIELDS
                source_agency = COALESCE($30, source_agency),
                lsb_resolution_no = COALESCE($31, lsb_resolution_no),
                moa_ref_no = COALESCE($32, moa_ref_no),
                validity_period = COALESCE($33, validity_period),
                contract_duration = COALESCE($34, contract_duration),
                date_approved_pow = COALESCE($35, date_approved_pow),
                fund_release_schedule = COALESCE($36, fund_release_schedule),
                mode_of_procurement = COALESCE($37, mode_of_procurement),
                philgeps_ref_no = COALESCE($38, philgeps_ref_no),
                pcab_license_no = COALESCE($39, pcab_license_no),
                date_contract_signing = COALESCE($40, date_contract_signing),
                bid_amount = COALESCE($41, bid_amount),
                nature_of_delay = COALESCE($42, nature_of_delay),
                date_notice_of_award = COALESCE($43, date_notice_of_award)

            WHERE project_id = $44
            RETURNING *;
        `;

    const values = [
      data.projectName, data.schoolName, data.schoolId,
      data.status, parseIntOrNull(data.accomplishmentPercentage),
      valueOrNull(data.statusAsOfDate), valueOrNull(data.targetCompletionDate),
      valueOrNull(data.actualCompletionDate), valueOrNull(data.noticeToProceed),
      valueOrNull(data.contractorName), parseNumberOrNull(data.projectAllocation),
      valueOrNull(data.batchOfFunds), valueOrNull(data.otherRemarks),
      valueOrNull(data.latitude), valueOrNull(data.longitude),
      // New
      valueOrNull(data.moa_date), parseIntOrNull(data.tranches_count), parseNumberOrNull(data.tranche_amount),
      valueOrNull(data.fund_source), valueOrNull(data.scope_of_works), parseNumberOrNull(data.contract_amount),
      valueOrNull(data.bid_opening_date), valueOrNull(data.resolution_award_date), valueOrNull(data.procurement_stage),
      valueOrNull(data.bidding_date), valueOrNull(data.awarding_date), valueOrNull(data.construction_start_date),
      parseNumberOrNull(data.funds_downloaded), parseNumberOrNull(data.funds_utilized),

      // Newest
      valueOrNull(data.source_agency),
      valueOrNull(data.lsb_resolution_no),
      valueOrNull(data.moa_ref_no),
      valueOrNull(data.validity_period),
      valueOrNull(data.contract_duration),
      valueOrNull(data.date_approved_pow),
      valueOrNull(data.fund_release_schedule),
      valueOrNull(data.mode_of_procurement),
      valueOrNull(data.philgeps_ref_no),
      valueOrNull(data.pcab_license_no),
      valueOrNull(data.date_contract_signing),
      parseNumberOrNull(data.bid_amount),
      valueOrNull(data.nature_of_delay),
      valueOrNull(data.date_notice_of_award),

      id
    ];

    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Project not found" });
    }

    // 2. Handle New Images (Append)
    if (data.newImages && Array.isArray(data.newImages) && data.newImages.length > 0) {
      const imageQuery = `INSERT INTO lgu_image (project_id, image_data, uploaded_by) VALUES ($1, $2, $3)`;
      for (const img of data.newImages) {
        await client.query(imageQuery, [id, img, data.uid]);
      }
    }

    await client.query('COMMIT');

    // Dual Write
    if (clientNew) {
      try {
        // Determine Secondary ID via IPC (safer) since IDs might drift
        const ipc = result.rows[0].ipc;
        if (ipc) {
          // Update on Secondary by IPC
          // Construct UPDATE by IPC... or just by ID if we trust it?
          // Let's rely on ID for now but catch error
          await clientNew.query(updateQuery, values);

          // Images
          if (data.newImages && Array.isArray(data.newImages)) {
            const secProjRes = await clientNew.query("SELECT project_id FROM lgu_forms WHERE ipc = $1", [ipc]);
            if (secProjRes.rows.length > 0) {
              const secId = secProjRes.rows[0].project_id;
              const imageQuery = `INSERT INTO lgu_image (project_id, image_data, uploaded_by) VALUES ($1, $2, $3)`;
              for (const img of data.newImages) {
                await clientNew.query(imageQuery, [secId, img, data.uid]);
              }
            }
          }
          await clientNew.query('COMMIT');
          console.log("✅ Dual-Write: LGU Update Synced");
        }
      } catch (dwErr) {
        console.error("❌ Dual-Write LGU Update Error", dwErr);
        await clientNew.query('ROLLBACK').catch(() => { });
      }
    }

    res.json({ success: true, project: result.rows[0] });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error("❌ LGU Update Project Error:", err.message);
    res.status(500).json({ error: "Failed to update project" });
  } finally {
    if (client) client.release();
    if (clientNew) clientNew.release();
  }
});


// --- POST: Save Facility Repair Assessment (ITEMIZED) ---
app.post('/api/save-facility-repair', async (req, res) => {
  const data = req.body;
  // data should look like: { schoolId, iern, building_no, room_no, items: [ { item_name, oms, condition... } ] }

  if (data.building_no) data.building_no = data.building_no.trim();
  if (data.room_no) data.room_no = data.room_no.trim();

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Delete existing items for this specific room
      await client.query(`
        DELETE FROM facility_repair_details 
        WHERE school_id = $1 AND building_no = $2 AND room_no = $3
      `, [data.schoolId, data.building_no, data.room_no]);

      // 2. Insert new items
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          await client.query(`
            INSERT INTO facility_repair_details (
              school_id, iern, building_no, room_no, item_name,
              oms, condition, damage_ratio, recommended_action, demo_justification, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            data.schoolId, data.iern || data.schoolId,
            data.building_no, data.room_no,
            item.item_name,
            item.oms || '',
            item.condition || '',
            item.damage_ratio || 0,
            item.recommended_action || '',
            item.demo_justification || '',
            item.remarks || ''
          ]);
        }
      }

      await client.query('COMMIT');

      // --- DUAL WRITE (Best Effort) ---
      if (poolNew) {
        (async () => {
          const cNew = await poolNew.connect();
          try {
            await cNew.query('BEGIN');
            await cNew.query(`
              DELETE FROM facility_repair_details 
              WHERE school_id = $1 AND building_no = $2 AND room_no = $3
            `, [data.schoolId, data.building_no, data.room_no]);

            if (data.items && Array.isArray(data.items)) {
              for (const item of data.items) {
                await cNew.query(`
                  INSERT INTO facility_repair_details (
                    school_id, iern, building_no, room_no, item_name,
                    oms, condition, damage_ratio, recommended_action, demo_justification, remarks
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                  data.schoolId, data.iern || data.schoolId,
                  data.building_no, data.room_no,
                  item.item_name,
                  item.oms || '',
                  item.condition || '',
                  item.damage_ratio || 0,
                  item.recommended_action || '',
                  item.demo_justification || '',
                  item.remarks || ''
                ]);
              }
            }
            await cNew.query('COMMIT');
          } catch (e) {
            await cNew.query('ROLLBACK');
            console.error("Dual write failed for repair details", e);
          } finally {
            cNew.release();
          }
        })();
      }

      res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Save Facility Repair Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- GET: Facility Repairs by IERN (ITEMIZED) ---
app.get('/api/facility-repairs/:iern', async (req, res) => {
  const { iern } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM facility_repair_details WHERE iern = $1 ORDER BY building_no, room_no, id ASC',
      [iern]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Get Facility Repairs Error:", err);
    res.status(500).json({ error: err.message });
  }
});


// Force start for PM2 (since isMainModule is false in PM2 fork mode)

// --- UNIFIED INITIALIZATION & STARTUP ---
const initializeAndStart = async () => {
  console.log("🚀 Starting InsightEd API Initialization...");

  try {
    // 1. Initial Primary Connection
    const client = await pool.connect();
    isDbConnected = true;
    console.log('✅ Connected to Postgres Database (Primary) successfully!');

    try {
      // 2. Sequential Migrations
      console.log("📦 Running Database Initializations...");
      await initOtpTable(pool);
      await initDB();
      await initFinanceDB();
      await initMasterlistDB();

      console.log("🛠️ Running Advanced Migrations (Primary)...");
      await runLegacyMigrations(); // Legacy blob
      await runMigrations(client, "Primary"); // Versioned migrations

      // 3. Secondary Database (Optional/Dual-Write)
      if (poolNew) {
        console.log("🔄 Initializing Secondary Database...");
        const clientNew = await poolNew.connect();
        try {
          await runMigrations(clientNew, "Secondary");
        } finally {
          clientNew.release();
        }
      }

    } finally {
      client.release();
    }

    console.log("✨ All Initializations Complete.");

    // 4. Start Listener
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 SERVER RUNNING ON PORT ${PORT} `);
      console.log(`👉 API Endpoint: http://localhost:${PORT}/api/send-otp`);
      console.log(`👉 CORS Allowed Origins: http://localhost:5173, https://insight-ed-mobile-pwa.vercel.app\n`);
    });

    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use! Please close the other process or use a different port.`);
      } else {
        console.error("❌ Server Error:", e);
      }
    });

  } catch (err) {
    console.error('❌ FATAL: Initialization Failed:', err.message);
    console.warn('⚠️  Server might be in an inconsistent state.');

    // Attempt fallback start if possible or exit
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log("⚠️ Continuing in Degraded/Mock mode for development...");
      isDbConnected = false;
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => console.log(`🚀 DEGRADED SERVER RUNNING ON PORT ${PORT}`));
    }
  }
};

// Check if main module and start using the isMainModule defined earlier
if (isMainModule || process.env.START_SERVER || true) {
  initializeAndStart();
}



export default app;



