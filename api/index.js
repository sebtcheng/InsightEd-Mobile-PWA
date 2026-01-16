import dotenv from 'dotenv';
import express from 'express';
import pg from 'pg';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Destructure Pool from pg
const { Pool } = pg;

const app = express();

// --- MIDDLEWARE ---
app.use(cors({
  origin: [
    'http://localhost:5173',           // Vite Local
    'https://insight-ed-mobile-pwa.vercel.app', // Your Vercel Frontend
    'https://insight-ed-frontend.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '50mb' }));

// --- DATABASE CONNECTION ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ FATAL: Could not connect to Neon DB:', err.message);
  } else {
    console.log('✅ Connected to Neon Database successfully!');
    release();
  }
});

// ==================================================================
//                        HELPER FUNCTIONS
// ==================================================================

const valueOrNull = (value) => (value === '' ? null : value);

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

/** Log Activity Helper */
const logActivity = async (userUid, userName, role, actionType, targetEntity, details) => {
  const query = `
        INSERT INTO activity_logs (user_uid, user_name, role, action_type, target_entity, details)
        VALUES ($1, $2, $3, $4, $5, $6)
    `;
  try {
    await pool.query(query, [userUid, userName, role, actionType, targetEntity, details]);
    console.log(`📝 Audit Logged: ${actionType} - ${targetEntity}`);
  } catch (err) {
    console.error("❌ Failed to log activity:", err.message);
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
  const { userUid, userName, role, actionType, targetEntity, details } = req.body;
  try {
    await logActivity(userUid, userName, role, actionType, targetEntity, details);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Log Error:", err);
    res.status(500).json({ error: "Failed to log" });
  }
});

// ==================================================================
//                        OTP & AUTH ROUTES
// ==================================================================

// Temporary in-memory store for OTPs (Use Redis/DB in production)
const otpStore = {};

// --- POST: Send OTP (Real Email via Nodemailer) ---
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  // Generate 6-digit code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in memory
  otpStore[email] = otp;

  try {
    // Dynamic import to avoid crash if not installed yet
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'cleamoniquesacriz@gmail.com',
        pass: process.env.EMAIL_PASS || 'bdfd nzoa ybby cjqc'
      }
    });

    const mailOptions = {
      from: '"InsightEd System" <cleamoniquesacriz@gmail.com>',
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
    console.log(`✅ Email sent to ${email}`);
    res.json({ success: true, message: "Verification code sent to your email!" });

  } catch (error) {
    console.error("❌ Email Error:", error);

    // Fallback to console for dev if email fails
    console.log(`⚠️ FALLBACK: OTP for ${email} is ${otp}`);

    // 4. FALLBACK: Return success so the user can verify via terminal code
    // (Even if email failed, we generated a valid OTP and logged it)
    console.log("⚠️ Returning SUCCESS despite email error (Fallback Mode)");

    return res.json({
      success: true,
      message: "Email failed, but code was generated. CHECK TERMINAL/CONSOLE."
    });
  }
});

// --- POST: Verify OTP ---
app.post('/api/verify-otp', async (req, res) => {
  const { email, code } = req.body;

  if (!otpStore[email]) {
    return res.status(400).json({ success: false, message: "No OTP found for this email. Request a new one." });
  }

  if (otpStore[email] === code) {
    delete otpStore[email]; // Clear after usage
    return res.json({ success: true, message: "Email Verified!" });
  } else {
    return res.status(400).json({ success: false, message: "Invalid Code. Please try again." });
  }
});

// --- 2. GET: Check School by USER ID ---
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

// ==================================================================
//                  SCHOOL HEAD FORMS ROUTES
// ==================================================================

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

    // 4. PERFORM INSERT OR UPDATE
    const query = `
      INSERT INTO school_profiles (
        school_id, school_name, region, province, division, district, 
        municipality, leg_district, barangay, mother_school_id, 
        latitude, longitude, submitted_by, submitted_at, 
        curricular_offering,
        history_logs
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, 
        $14,
        jsonb_build_array($15::jsonb) 
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
        history_logs = school_profiles.history_logs || $15::jsonb;
    `;

    const values = [
      data.schoolId, data.schoolName, data.region, data.province,
      data.division, data.district, data.municipality, data.legDistrict,
      data.barangay, data.motherSchoolId, data.latitude, data.longitude,
      data.submittedBy,
      data.curricularOffering, // $14
      JSON.stringify(newLogEntry) // $15
    ];

    await client.query(query, values);
    await client.query('COMMIT');

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

    res.status(200).json({ message: "Profile saved successfully!", changes: changes });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Save Error:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  } finally {
    client.release();
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
        head_sex = $8,
        head_region = $9,
        head_division = $10,
        updated_at = CURRENT_TIMESTAMP,
        history_logs = history_logs || $11::jsonb
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
      data.sex || null,
      data.region || null,
      data.division || null,
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
        head_sex as sex, 
        head_region as region, 
        head_division as division,
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

// --- 7. POST: Save Enrolment ---
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
        submitted_at = CURRENT_TIMESTAMP,
        history_logs = history_logs || $40::jsonb
      WHERE school_id = $1;
    `;

    const values = [
      data.schoolId, data.curricularOffering,
      data.esTotal, data.jhsTotal, data.shsTotal, data.grandTotal,
      data.gradeKinder, data.grade1, data.grade2, data.grade3,
      data.grade4, data.grade5, data.grade6,
      data.grade7, data.grade8, data.grade9, data.grade10,
      data.grade11, data.grade12,
      data.abm11, data.abm12, data.stem11, data.stem12,
      data.humss11, data.humss12, data.gas11, data.gas12,
      data.ict11, data.ict12, data.he11, data.he12,
      data.ia11, data.ia12, data.afa11, data.afa12,
      data.arts11, data.arts12, data.sports11, data.sports12,
      JSON.stringify(newLogEntry)
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "School Profile not found." });
    }

    // --- CENTRALIZED AUDIT LOG ---
    await logActivity(
      data.submittedBy,
      'School Head',
      'School Head',
      'UPDATE',
      `Enrolment Data: ${data.schoolId}`,
      `Updated enrolment (Total: ${data.grandTotal})`
    );

    res.status(200).json({ message: "Enrolment updated successfully!" });

  } catch (err) {
    console.error("Enrolment Save Error:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  }
});


// ==================================================================
//                    ENGINEER FORMS ROUTES
// ==================================================================

// --- 8. POST: Save New Project (Updated for Images & Transactions) ---
app.post('/api/save-project', async (req, res) => {
  const client = await pool.connect(); // Use a client to handle transactions
  const data = req.body;

  if (!data.schoolName || !data.projectName || !data.schoolId) {
    client.release();
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await client.query('BEGIN'); // Start Transaction

    // 1. Prepare Project Data
    // We added data.uid (the Firestore ID) as the 16th value ($16)
    const projectValues = [
      data.projectName, data.schoolName, data.schoolId,
      valueOrNull(data.region), valueOrNull(data.division),
      data.status || 'Not Yet Started', parseIntOrNull(data.accomplishmentPercentage),
      valueOrNull(data.statusAsOfDate), valueOrNull(data.targetCompletionDate),
      valueOrNull(data.actualCompletionDate), valueOrNull(data.noticeToProceed),
      valueOrNull(data.contractorName), parseNumberOrNull(data.projectAllocation),
      valueOrNull(data.batchOfFunds), valueOrNull(data.otherRemarks),
      data.uid // <--- This captures the Firestore UID from the frontend
    ];

    const projectQuery = `
      INSERT INTO "engineer_form" (
        project_name, school_name, school_id, region, division,
        status, accomplishment_percentage, status_as_of,
        target_completion_date, actual_completion_date, notice_to_proceed,
        contractor_name, project_allocation, batch_of_funds, other_remarks,
        engineer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING project_id, project_name;
    `;

    // 2. Insert Project
    const projectResult = await client.query(projectQuery, projectValues);
    const newProject = projectResult.rows[0];
    const newProjectId = newProject.project_id;

    // 3. Insert Images (If they exist in the payload)
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const imageQuery = `
        INSERT INTO "engineer_image" (project_id, image_data, uploaded_by)
        VALUES ($1, $2, $3)
      `;

      // Loop through images and insert them linked to the newProjectId
      for (const imgBase64 of data.images) {
        await client.query(imageQuery, [newProjectId, imgBase64, data.uid]);
      }
    }

    await client.query('COMMIT'); // Commit the transaction (save everything)

    // 4. Log Activity (Outside transaction is fine, or inside if preferred)
    // Note: Ensure logActivity uses 'pool' internally or pass 'client' if you want it in the transaction. 
    // Assuming logActivity works independently:
    await logActivity(
      data.uid,
      data.modifiedBy,
      'Engineer',
      'CREATE',
      `Project: ${newProject.project_name}`,
      `Created new project for ${data.schoolName} with ${data.images ? data.images.length : 0} photos`
    );

    res.status(200).json({ message: "Project and images saved!", project: newProject });

  } catch (err) {
    await client.query('ROLLBACK'); // Revert changes if anything fails
    console.error("❌ SQL ERROR:", err.message);
    res.status(500).json({ message: "Database error", error: err.message });
  } finally {
    client.release(); // Release the client back to the pool
  }
});
// --- 9. PUT: Update Project ---
app.put('/api/update-project/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const query = `
    UPDATE "engineer_form"
    SET status = $1, accomplishment_percentage = $2, status_as_of = $3, other_remarks = $4
    WHERE project_id = $5
    RETURNING *;
  `;

  const values = [
    data.status, parseIntOrNull(data.accomplishmentPercentage),
    valueOrNull(data.statusAsOfDate), valueOrNull(data.otherRemarks), id
  ];

  try {
    const result = await pool.query(query, values);

    if (result.rowCount === 0) return res.status(404).json({ message: "Project not found" });

    await logActivity(
      data.uid,
      data.modifiedBy,
      'Engineer',
      'UPDATE',
      `Project ID: ${id}`,
      `Updated status to ${data.status} (${data.accomplishmentPercentage}%)`
    );

    res.json({ message: "Update successful", project: result.rows[0] });
  } catch (err) {
    console.error("❌ Error updating project:", err.message);
    res.status(500).json({ message: "Server error" });
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
      SELECT 
        project_id AS "id", school_name AS "schoolName", project_name AS "projectName",
        school_id AS "schoolId", division, region, status,
        accomplishment_percentage AS "accomplishmentPercentage",
        project_allocation AS "projectAllocation", batch_of_funds AS "batchOfFunds",
        contractor_name AS "contractorName", other_remarks AS "otherRemarks",
        TO_CHAR(status_as_of, 'YYYY-MM-DD') AS "statusAsOfDate",
        TO_CHAR(target_completion_date, 'YYYY-MM-DD') AS "targetCompletionDate",
        TO_CHAR(actual_completion_date, 'YYYY-MM-DD') AS "actualCompletionDate",
        TO_CHAR(notice_to_proceed, 'YYYY-MM-DD') AS "noticeToProceed"
      FROM "engineer_form"
    `;

    // 1. ADD FILTER: Only show projects belonging to this engineer
    if (engineer_id) {
      queryParams.push(engineer_id);
      whereClauses.push(`engineer_id = $${queryParams.length}`);
    }

    // 2. Add your existing filters
    if (status) {
      queryParams.push(status);
      whereClauses.push(`status = $${queryParams.length}`);
    }
    if (region) {
      queryParams.push(region);
      whereClauses.push(`region = $${queryParams.length}`);
    }
    if (division) {
      queryParams.push(division);
      whereClauses.push(`division = $${queryParams.length}`);
    }
    if (search) {
      queryParams.push(`%${search}%`);
      whereClauses.push(`(school_name ILIKE $${queryParams.length} OR project_name ILIKE $${queryParams.length})`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY project_id DESC`;

    const result = await pool.query(sql, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching projects:", err.message);
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
        school_id AS "schoolId", division, region, status,
        accomplishment_percentage AS "accomplishmentPercentage",
        project_allocation AS "projectAllocation", batch_of_funds AS "batchOfFunds",
        contractor_name AS "contractorName", other_remarks AS "otherRemarks",
        TO_CHAR(status_as_of, 'YYYY-MM-DD') AS "statusAsOfDate",
        TO_CHAR(target_completion_date, 'YYYY-MM-DD') AS "targetCompletionDate",
        TO_CHAR(actual_completion_date, 'YYYY-MM-DD') AS "actualCompletionDate",
        TO_CHAR(notice_to_proceed, 'YYYY-MM-DD') AS "noticeToProceed"
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
        school_id AS "schoolId", division, region, status, validation_status,
        validation_remarks AS "validationRemarks", validated_by AS "validatedBy",
        accomplishment_percentage AS "accomplishmentPercentage",
        project_allocation AS "projectAllocation", batch_of_funds AS "batchOfFunds",
        contractor_name AS "contractorName", other_remarks AS "otherRemarks",
        TO_CHAR(status_as_of, 'YYYY-MM-DD') AS "statusAsOfDate",
        TO_CHAR(target_completion_date, 'YYYY-MM-DD') AS "targetCompletionDate",
        TO_CHAR(actual_completion_date, 'YYYY-MM-DD') AS "actualCompletionDate",
        TO_CHAR(notice_to_proceed, 'YYYY-MM-DD') AS "noticeToProceed"
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
  } catch (err) {
    console.error("Validation Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- 20. POST: Upload Project Image (Base64) ---
app.post('/api/upload-image', async (req, res) => {
  const { projectId, imageData, uploadedBy } = req.body;
  if (!projectId || !imageData) return res.status(400).json({ error: "Missing required data" });

  try {
    const query = `INSERT INTO engineer_image (project_id, image_data, uploaded_by) VALUES ($1, $2, $3) RETURNING id;`;
    const result = await pool.query(query, [projectId, imageData, uploadedBy]);

    await logActivity(uploadedBy, 'Engineer', 'Engineer', 'UPLOAD', `Project ID: ${projectId}`, `Uploaded a new site image`);
    res.status(201).json({ success: true, imageId: result.rows[0].id });
  } catch (err) {
    console.error("❌ Image Upload Error:", err.message);
    res.status(500).json({ error: "Failed to save image to database" });
  }
});

// --- 21. GET: Fetch All Images for a Project ---
app.get('/api/project-images/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    const query = `SELECT id, image_data, uploaded_by, created_at FROM engineer_image WHERE project_id = $1 ORDER BY created_at DESC;`;
    const result = await pool.query(query, [projectId]);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching project images:", err.message);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// --- 22. GET: Fetch All Images for an Engineer ---
app.get('/api/engineer-images/:engineerId', async (req, res) => {
  const { engineerId } = req.params;
  try {
    const query = `
      SELECT ei.id, ei.image_data, ei.created_at, ef.school_name 
      FROM engineer_image ei
      LEFT JOIN engineer_form ef ON ei.project_id = ef.project_id
      WHERE ei.uploaded_by = $1 
      ORDER BY ei.created_at DESC;
    `;
    const result = await pool.query(query, [engineerId]);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching engineer gallery:", err.message);
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
                classes_grade_11, classes_grade_12
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
        grade_11: row.classes_grade_11, grade_12: row.classes_grade_12
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// --- 16. POST: Save Organized Classes (UPDATED) ---
app.post('/api/save-organized-classes', async (req, res) => {
  const data = req.body;
  try {
    // We now UPDATE school_profiles instead of inserting into a new table
    const query = `
            UPDATE school_profiles SET
                classes_kinder = $2, 
                classes_grade_1 = $3, classes_grade_2 = $4, classes_grade_3 = $5,
                classes_grade_4 = $6, classes_grade_5 = $7, classes_grade_6 = $8,
                classes_grade_7 = $9, classes_grade_8 = $10, classes_grade_9 = $11,
                classes_grade_10 = $12, classes_grade_11 = $13, classes_grade_12 = $14
            WHERE school_id = $1
        `;

    await pool.query(query, [
      data.schoolId,
      data.kinder,
      data.g1, data.g2, data.g3, data.g4, data.g5, data.g6,
      data.g7, data.g8, data.g9, data.g10,
      data.g11, data.g12
    ]);

    res.json({ message: "Classes saved successfully!" });
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
                teach_g11, teach_g12
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
        teach_g11: row.teach_g11, teach_g12: row.teach_g12
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
                updated_at = CURRENT_TIMESTAMP
            WHERE TRIM(submitted_by) = TRIM($1)
            RETURNING school_id;
        `;

    const values = [
      d.uid,                          // $1
      d.teach_kinder || 0, d.teach_g1 || 0, d.teach_g2 || 0,
      d.teach_g3 || 0, d.teach_g4 || 0, d.teach_g7 || 0,
      d.teach_g8 || 0, d.teach_g9 || 0, d.teach_g10 || 0,
      d.teach_g11 || 0, d.teach_g12 || 0, d.teach_g5 || 0,
      d.teach_g6 || 0
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      console.error("❌ SQL matched 0 rows for UID:", d.uid);
      return res.status(404).json({ error: "No matching record found in Neon." });
    }

    console.log("✅ Neon Updated Successfully for School:", result.rows[0].school_id);
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Neon Database Error:", err.message);
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
  try {
    const query = `
            UPDATE school_profiles SET
                res_armchairs_good=$2, res_armchairs_repair=$3, res_teacher_tables_good=$4, res_teacher_tables_repair=$5,
                res_blackboards_good=$6, res_blackboards_defective=$7,
                res_desktops_instructional=$8, res_desktops_admin=$9, res_laptops_teachers=$10, res_tablets_learners=$11,
                res_printers_working=$12, res_projectors_working=$13, res_internet_type=$14,
                res_toilets_male=$15, res_toilets_female=$16, res_toilets_pwd=$17, res_faucets=$18, res_water_source=$19,
                res_sci_labs=$20, res_com_labs=$21, res_tvl_workshops=$22,
                
                res_ownership_type=$23, res_electricity_source=$24, res_buildable_space=$25,

                seats_kinder=$26, seats_grade_1=$27, seats_grade_2=$28, seats_grade_3=$29,
                seats_grade_4=$30, seats_grade_5=$31, seats_grade_6=$32,
                seats_grade_7=$33, seats_grade_8=$34, seats_grade_9=$35, seats_grade_10=$36,
                seats_grade_11=$37, seats_grade_12=$38,

                updated_at=CURRENT_TIMESTAMP
            WHERE school_id=$1
        `;
    const result = await pool.query(query, [
      data.schoolId,
      data.res_armchairs_good, data.res_armchairs_repair, data.res_teacher_tables_good, data.res_teacher_tables_repair,
      data.res_blackboards_good, data.res_blackboards_defective,
      data.res_desktops_instructional, data.res_desktops_admin, data.res_laptops_teachers, data.res_tablets_learners,
      data.res_printers_working, data.res_projectors_working, data.res_internet_type,
      data.res_toilets_male, data.res_toilets_female, data.res_toilets_pwd, data.res_faucets, data.res_water_source,
      data.res_sci_labs, data.res_com_labs, data.res_tvl_workshops,

      data.res_ownership_type, data.res_electricity_source, data.res_buildable_space,

      data.seats_kinder, data.seats_grade_1, data.seats_grade_2, data.seats_grade_3,
      data.seats_grade_4, data.seats_grade_5, data.seats_grade_6,
      data.seats_grade_7, data.seats_grade_8, data.seats_grade_9, data.seats_grade_10,
      data.seats_grade_11, data.seats_grade_12
    ]);
    if (result.rowCount === 0) {
      console.warn(`[Resources] ID ${data.schoolId} not found.`);
      return res.status(404).json({ error: "School Profile not found" });
    }
    console.log("[Resources] Success");
    res.json({ message: "Resources saved!" });
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
    res.json({ exists: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 24. POST: Save Teacher Specialization ---
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
      d.spec_ict_coord || 0, d.spec_drrm_coord || 0
    ];
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: "Profile not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ==================================================================
//                    MONITORING & JURISDICTION ROUTES
// ==================================================================

// --- 25. GET: Monitoring Stats (RO / SDO) ---
app.get('/api/monitoring/stats', async (req, res) => {
  const { region, division } = req.query;
  try {
    let whereClause = `WHERE TRIM(region) = TRIM($1)`;
    let params = [region];

    if (division) {
      whereClause += ` AND TRIM(division) = TRIM($2)`;
      params.push(division);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_schools,
        COUNT(CASE WHEN school_name IS NOT NULL THEN 1 END) as profile,
        COUNT(CASE WHEN head_last_name IS NOT NULL THEN 1 END) as head,
        COUNT(CASE WHEN total_enrollment > 0 THEN 1 END) as enrollment,
        COUNT(CASE WHEN classes_kinder IS NOT NULL THEN 1 END) as organizedclasses,
        COUNT(CASE WHEN shift_kinder IS NOT NULL THEN 1 END) as shifting,
        COUNT(CASE WHEN teach_kinder > 0 THEN 1 END) as personnel,
        COUNT(CASE WHEN spec_math_major > 0 OR spec_guidance > 0 THEN 1 END) as specialization,
        COUNT(CASE WHEN res_armchairs_good > 0 OR res_toilets_male > 0 THEN 1 END) as resources
      FROM school_profiles
      ${whereClause}
    `;

    const result = await pool.query(statsQuery, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Monitoring Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- 26. GET: List Schools in Jurisdiction ---
app.get('/api/monitoring/schools', async (req, res) => {
  const { region, division } = req.query;
  try {
    let query = `
      SELECT 
        school_id, school_name, region, division, district,
        (CASE WHEN school_name IS NOT NULL THEN true ELSE false END) as profile_status,
        (CASE WHEN head_last_name IS NOT NULL THEN true ELSE false END) as head_status,
        (CASE WHEN total_enrollment > 0 THEN true ELSE false END) as enrollment_status,
        (CASE WHEN classes_kinder IS NOT NULL THEN true ELSE false END) as classes_status,
        (CASE WHEN shift_kinder IS NOT NULL THEN true ELSE false END) as shifting_status,
        (CASE WHEN teach_kinder > 0 THEN true ELSE false END) as personnel_status,
        (CASE WHEN spec_math_major > 0 OR spec_guidance > 0 THEN true ELSE false END) as specialization_status,
        (CASE WHEN res_armchairs_good > 0 OR res_toilets_male > 0 THEN true ELSE false END) as resources_status
      FROM school_profiles
      WHERE TRIM(region) = TRIM($1)
    `;
    let params = [region];

    if (division) {
      query += ` AND TRIM(division) = TRIM($2) `;
      params.push(division);
    }

    query += ` ORDER BY school_name ASC `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Jurisdiction Schools Error:", err);
    res.status(500).json({ error: "Failed to fetch schools" });
  }
});

// --- 27. GET: Engineer Project Stats for Jurisdiction ---
app.get('/api/monitoring/engineer-stats', async (req, res) => {
  const { region, division } = req.query;
  try {
    let query = `
      SELECT 
        COUNT(*) as total_projects,
        AVG(accomplishment_percentage)::NUMERIC(10,2) as avg_progress,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'Ongoing' THEN 1 END) as ongoing_count
      FROM engineer_form
      WHERE TRIM(region) = TRIM($1)
    `;
    let params = [region];

    if (division) {
      query += ` AND TRIM(division) = TRIM($2) `;
      params.push(division);
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
        project_id as id, project_name as "projectName", school_id as "schoolId", school_name as "schoolName", 
        accomplishment_percentage as "accomplishmentPercentage", status, 
        validation_status as "validation_status", status_as_of as "statusAsOfDate"
      FROM engineer_form
      WHERE TRIM(region) = TRIM($1)
    `;
    let params = [region];

    if (division) {
      query += ` AND TRIM(division) = TRIM($2) `;
      params.push(division);
    }

    query += ` ORDER BY created_at DESC `;

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
app.get('/api/leaderboard', async (req, res) => {
  const { scope, filter } = req.query; // scope: 'region' (for RO) or 'division' (for SDO/Head)
  try {
    let whereClause = '';
    let params = [];

    if (scope === 'division') {
      whereClause = 'WHERE division = $1';
      params.push(filter);
    } else if (scope === 'region') {
      whereClause = 'WHERE region = $1';
      params.push(filter);
    }

    const query = `
            SELECT 
                school_id, school_name, division, region,
                
                -- Calculate Completion Percentage (Simple Weighting)
                (
                    (CASE WHEN school_name IS NOT NULL THEN 1 ELSE 0 END) + -- Basic Profile
                    (CASE WHEN total_enrollment > 0 THEN 1 ELSE 0 END) +    -- Enrollment
                    (CASE WHEN head_last_name IS NOT NULL THEN 1 ELSE 0 END) + -- School Head
                    (CASE WHEN res_toilets_male > 0 OR res_armchairs_good > 0 THEN 1 ELSE 0 END) + -- Resources (Basic Check)
                    (CASE WHEN classes_kinder IS NOT NULL THEN 1 ELSE 0 END) + -- Classes
                    (CASE WHEN teach_kinder IS NOT NULL THEN 1 ELSE 0 END) + -- Personnel
                    (CASE WHEN spec_math_major > 0 OR spec_english_major > 0 THEN 1 ELSE 0 END) -- Specialization
                ) * 100.0 / 7.0 as completion_rate,

                updated_at
            FROM school_profiles
            ${whereClause}
            ORDER BY completion_rate DESC, updated_at DESC
        `;

    const result = await pool.query(query, params);

    // Calculate Division Averages if requesting Regional View
    let responseData = { schools: result.rows };

    if (scope === 'region') {
      const divMap = {};
      result.rows.forEach(s => {
        if (!divMap[s.division]) divMap[s.division] = { name: s.division, total: 0, count: 0 };
        divMap[s.division].total += parseFloat(s.completion_rate);
        divMap[s.division].count++;
      });
      responseData.divisions = Object.values(divMap).map(d => ({
        name: d.name,
        avg_completion: (d.total / d.count).toFixed(1)
      })).sort((a, b) => b.avg_completion - a.avg_completion);
    }

    res.json(responseData);
  } catch (err) {
    console.error("Leaderboard Error:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ==================================================================
//                        SERVER STARTUP
// ==================================================================

// 1. FOR LOCAL DEVELOPMENT (runs when you type 'node api/index.js')
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 SERVER RUNNING ON PORT ${PORT}`);
    console.log(`👉 API Endpoint: http://localhost:${PORT}/api/send-otp`);
    console.log(`👉 CORS Allowed Origins: http://localhost:5173, https://insight-ed-mobile-pwa.vercel.app\n`);
  });
}

// 2. FOR VERCEL (Production)
// Export default is required for ESM in Vercel
export default app;