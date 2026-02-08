
// --- DATABASE INITIALIZATION & MIGRATIONS ---1111111111

const initOtpTable = async (pool) => {
    try {
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'verification_codes'
            );
        `);
        if (res.rows[0].exists) {
            // console.log("✅ OTP Table Exists");
            return;
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                email VARCHAR(255) PRIMARY KEY,
                code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes')
            );
        `);
        console.log("✅ OTP Table Initialized");
    } catch (err) {
        console.error("❌ Failed to init OTP table:", err.message);
    }
};

const runMigrations = async (client, dbLabel) => {
    console.log(`🚀 Starting Migrations for ${dbLabel}...`);

    // --- 2. NOTIFICATIONS TABLE ---
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
        console.log(`✅ [${dbLabel}] Notifications Table Initialized`);
    } catch (tableErr) {
        console.error(`❌ [${dbLabel}] Failed to init notifications table:`, tableErr.message);
    }

    // --- 3. SCHOOL PROFILES EXTENSIONS ---
    try {
        // Add Email
        await client.query(`ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS email TEXT;`);
        // Add Curricular Offering
        await client.query(`ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS curricular_offering TEXT;`);
        // Add Resources Columns
        await client.query(`
        ALTER TABLE school_profiles 
        ADD COLUMN IF NOT EXISTS res_toilets_common INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sha_category TEXT,
        ADD COLUMN IF NOT EXISTS res_faucets INTEGER DEFAULT 0;
    `);
        // Add Site & Utils
        await client.query(`
        ALTER TABLE school_profiles 
        ADD COLUMN IF NOT EXISTS res_ownership_type TEXT,
        ADD COLUMN IF NOT EXISTS res_electricity_source TEXT,
        ADD COLUMN IF NOT EXISTS res_buildable_space TEXT,
        ADD COLUMN IF NOT EXISTS res_water_source TEXT,
        ADD COLUMN IF NOT EXISTS res_internet_type TEXT;
    `);
        console.log(`✅ [${dbLabel}] School Profiles Schema Updated (Basic Extensions)`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate school_profiles basic:`, migErr.message);
    }

    // --- 4. USER DEVICE TOKENS ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_device_tokens (
                uid TEXT PRIMARY KEY,
                fcm_token TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log(`✅ [${dbLabel}] User Device Tokens Table Initialized`);
    } catch (tokenErr) {
        console.error(`❌ [${dbLabel}] Failed to init user_device_tokens:`, tokenErr.message);
    }

    // --- 5. USERS TABLE EXTENSIONS ---
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
            ADD COLUMN IF NOT EXISTS contact_number TEXT,
            ADD COLUMN IF NOT EXISTS alt_email TEXT,
            ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;
        `);
        console.log(`✅ [${dbLabel}] Users Table Schema Updated`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate users table:`, migErr.message);
    }

    // --- 6. COMPREHENSIVE SCHOOL PROFILE COLUMNS (Detailed) ---
    try {
        await client.query(`
        ALTER TABLE school_profiles 
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

        -- Class Size Analysis (CRITICAL FOR ORGANIZED CLASSES DUAL-WRITE)
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
        console.log(`✅ [${dbLabel}] Detailed School Analysis & Inventory Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate detailed columns:`, migErr.message);
    }

    // --- 7. TEACHER SPECIALIZATION ---
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
        ADD COLUMN IF NOT EXISTS spec_general_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_general_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ece_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ece_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_bio_sci_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_bio_sci_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_phys_sci_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_phys_sci_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_agri_fishery_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_agri_fishery_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_others_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_others_teaching INTEGER DEFAULT 0;
      `);
        console.log(`✅ [${dbLabel}] Teacher Specialization Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate specialization columns:`, migErr.message);
    }

    // --- 8. ENGINEER FORM SCHEMA ---
    try {
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
            ADD COLUMN IF NOT EXISTS ipc TEXT UNIQUE,
            ADD COLUMN IF NOT EXISTS latitude TEXT,
            ADD COLUMN IF NOT EXISTS longitude TEXT,
            ADD COLUMN IF NOT EXISTS engineer_name TEXT;
        `);
        await client.query(`
          ALTER TABLE engineer_form 
          DROP CONSTRAINT IF EXISTS engineer_form_ipc_key; 
        `);
        console.log(`✅ [${dbLabel}] Engineer Form Schema Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate engineer_form:`, migErr.message);
    }

    // --- 9. ARAL & TEACHING EXPERIENCE ---
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
        console.log(`✅ [${dbLabel}] ARAL & Teaching Experience Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate ARAL/Exp columns:`, migErr.message);
    }

    // --- 10. DETAILED ENROLLMENT ---
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
        console.log(`✅ [${dbLabel}] Detailed Enrollment Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate enrollment columns:`, migErr.message);
    }

    // --- 11. BUILDABLE SPACE TYPE FIX ---
    try {
        await client.query(`ALTER TABLE school_profiles ALTER COLUMN res_buildable_space TYPE TEXT;`);
        console.log(`✅ [${dbLabel}] Ensured buildable_space is TEXT`);
    } catch (migErr) { }

    // --- 12. SYSTEM SETTINGS ---
    try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS system_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT
          );
        `);
        console.log(`✅ [${dbLabel}] System Settings Table Initialized`);
    } catch (tableErr) {
        console.error(`❌ [${dbLabel}] Failed to init system_settings table:`, tableErr.message);
    }

    // --- 13. MONITORING SNAPSHOT COLUMNS ---
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
        console.log(`✅ [${dbLabel}] Monitoring Snapshot Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate snapshot columns:`, migErr.message);
    }

    // --- 14. PENDING SCHOOLS TABLE (SDO Submission & Admin Approval) ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS pending_schools (
                pending_id SERIAL PRIMARY KEY,
                
                -- School Information (exact match to schools table)
                school_id TEXT UNIQUE NOT NULL,
                school_name TEXT NOT NULL,
                region TEXT NOT NULL,
                division TEXT NOT NULL,
                district TEXT,
                province TEXT,
                municipality TEXT,
                leg_district TEXT,
                barangay TEXT,
                street_address TEXT,
                mother_school_id TEXT,
                curricular_offering TEXT,
                
                -- Location Data
                latitude NUMERIC(10, 7),
                longitude NUMERIC(10, 7),
                
                -- Submission Metadata
                submitted_by TEXT NOT NULL,
                submitted_by_name TEXT,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Approval Status
                status TEXT DEFAULT 'pending',
                reviewed_by TEXT,
                reviewed_by_name TEXT,
                reviewed_at TIMESTAMP,
                rejection_reason TEXT
            );
        `);
        console.log(`✅ [${dbLabel}] Pending Schools Table Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to create pending_schools table:`, migErr.message);
    }
};

export { initOtpTable, runMigrations };
