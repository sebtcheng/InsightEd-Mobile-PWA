require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 1. GET ROUTE: Check by USER ID (The "Gatekeeper") ---
app.get('/api/school-by-user/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE submitted_by = $1', [uid]);
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

// --- 2. POST ROUTE: Save School Profile (Profile Data Only) ---
app.post('/api/save-school', async (req, res) => {
  const data = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); 

    // Create Log Entry
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      user: data.submittedBy,
      action: "Profile Update"
    };

    // UPSERT QUERY
    const query = `
      INSERT INTO school_profiles (
        school_id, school_name, region, province, division, district, 
        municipality, leg_district, barangay, mother_school_id, 
        latitude, longitude, submitted_by, submitted_at, 
        history_logs -- <--- TARGETING THE NEW COLUMN
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, 
        jsonb_build_array($14::jsonb) -- Start with array containing 1 log
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
        submitted_by = EXCLUDED.submitted_by,
        submitted_at = CURRENT_TIMESTAMP,
        -- COMBINE OLD LOGS + NEW LOG
        history_logs = school_profiles.history_logs || $14::jsonb;
    `;
    
    const values = [
      data.schoolId, data.schoolName, data.region, data.province, 
      data.division, data.district, data.municipality, data.legDistrict, 
      data.barangay, data.motherSchoolId, data.latitude, data.longitude, 
      data.submittedBy,
      JSON.stringify(newLogEntry) // $14: The new log object
    ];

    await client.query(query, values);
    await client.query('COMMIT');
    res.status(200).json({ message: "Profile saved successfully!" });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Save Error:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  } finally {
    client.release();
  }
});

// --- 3. GET ROUTE: Check by School ID (Helper) ---
app.get('/api/check-school/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_profiles WHERE school_id = $1', [id]);
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: "Check failed" });
  }
});

// --- 4. POST ROUTE: SAVE School Head Info ---
app.post('/api/save-school-head', async (req, res) => {
  const { uid, lastName, firstName, middleName, itemNumber, positionTitle, dateHired } = req.body;
  try {
    const query = `
      INSERT INTO school_heads (
        user_uid, last_name, first_name, middle_name, 
        item_number, position_title, date_hired
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_uid) 
      DO UPDATE SET 
        last_name = EXCLUDED.last_name,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        item_number = EXCLUDED.item_number,
        position_title = EXCLUDED.position_title,
        date_hired = EXCLUDED.date_hired,
        updated_at = CURRENT_TIMESTAMP;
    `;
    
    await pool.query(query, [uid, lastName, firstName, middleName, itemNumber, positionTitle, dateHired]);
    res.json({ success: true, message: "School Head saved successfully" });

  } catch (err) {
    console.error("Save Head Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 5. GET ROUTE: GET School Head Info ---
app.get('/api/school-head/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query('SELECT * FROM school_heads WHERE user_uid = $1', [uid]);
    
    if (result.rows.length > 0) {
      res.json({ exists: true, data: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("Get Head Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- 6. POST ROUTE: SAVE ENROLMENT ONLY (Prevents NULL Bug) ---
// --- 6. NEW ROUTE: SAVE ENROLMENT (With SHS Tracks & Totals) ---
app.post('/api/save-enrolment', async (req, res) => {
  const data = req.body;
  
  const newLogEntry = {
    timestamp: new Date().toISOString(),
    user: data.submittedBy,
    action: "Enrolment Update",
    offering: data.curricularOffering
  };

  try {
    const query = `
      UPDATE school_profiles 
      SET 
        curricular_offering = $2,
        
        -- TOTALS
        es_enrollment = $3, jhs_enrollment = $4, 
        shs_enrollment = $5, total_enrollment = $6,

        -- ELEMENTARY & JHS (Standard)
        grade_kinder = $7, grade_1 = $8, grade_2 = $9, grade_3 = $10,
        grade_4 = $11, grade_5 = $12, grade_6 = $13,
        grade_7 = $14, grade_8 = $15, grade_9 = $16, grade_10 = $17,

        -- SHS TOTALS (Calculated from strands)
        grade_11 = $18, grade_12 = $19,

        -- ACADEMIC STRANDS
        abm_11=$20, abm_12=$21, stem_11=$22, stem_12=$23,
        humss_11=$24, humss_12=$25, gas_11=$26, gas_12=$27,

        -- TVL STRANDS
        tvl_ict_11=$28, tvl_ict_12=$29, tvl_he_11=$30, tvl_he_12=$31,
        tvl_ia_11=$32, tvl_ia_12=$33, tvl_afa_11=$34, tvl_afa_12=$35,

        -- OTHER TRACKS
        arts_11=$36, arts_12=$37, sports_11=$38, sports_12=$39,

        submitted_at = CURRENT_TIMESTAMP,
        history_logs = history_logs || $40::jsonb
      WHERE school_id = $1;
    `;
    
    const values = [
      data.schoolId, data.curricularOffering,
      // Totals
      data.esTotal, data.jhsTotal, data.shsTotal, data.grandTotal,
      // Elem/JHS
      data.gradeKinder, data.grade1, data.grade2, data.grade3, 
      data.grade4, data.grade5, data.grade6,
      data.grade7, data.grade8, data.grade9, data.grade10,
      // SHS Totals
      data.grade11, data.grade12,
      // Academic
      data.abm11, data.abm12, data.stem11, data.stem12,
      data.humss11, data.humss12, data.gas11, data.gas12,
      // TVL
      data.ict11, data.ict12, data.he11, data.he12,
      data.ia11, data.ia12, data.afa11, data.afa12,
      // Others
      data.arts11, data.arts12, data.sports11, data.sports12,
      // Log
      JSON.stringify(newLogEntry)
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "School Profile not found." });
    }

    res.status(200).json({ message: "Enrolment updated successfully!" });

  } catch (err) {
    console.error("Enrolment Save Error:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});