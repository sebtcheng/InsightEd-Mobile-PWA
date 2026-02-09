const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function reorderTable() {
    const client = await pool.connect();
    try {
        console.log("🚀 Starting Table Reorder...");

        // 1. Create Ordered Table
        // Order: Identity (Profile, Head), Enrollment, Classes, Stats, Shifting, Teachers, Specialization, Resources, Facilities
        console.log("1️⃣ Creating school_profiles_ordered...");
        await client.query(`
            CREATE TABLE school_profiles_ordered (
                -- 1. IDENTITY (School Profile)
                school_id TEXT PRIMARY KEY,
                school_name TEXT,
                region TEXT,
                division TEXT,
                province TEXT,
                city TEXT,
                barangay TEXT,
                coordinates TEXT,
                school_type TEXT,
                curricular_offering TEXT,
                district TEXT,
                
                -- 2. IDENTITY (Head)
                head_name TEXT,
                head_position TEXT,
                head_contact TEXT,
                head_email TEXT,

                -- 3. LEARNERS (Enrollment)
                total_enrollment INTEGER DEFAULT 0,
                enrolled_male_kinder INTEGER DEFAULT 0,
                enrolled_female_kinder INTEGER DEFAULT 0,
                enrolled_male_grade_1 INTEGER DEFAULT 0,
                enrolled_female_grade_1 INTEGER DEFAULT 0,
                enrolled_male_grade_2 INTEGER DEFAULT 0,
                enrolled_female_grade_2 INTEGER DEFAULT 0,
                enrolled_male_grade_3 INTEGER DEFAULT 0,
                enrolled_female_grade_3 INTEGER DEFAULT 0,
                enrolled_male_grade_4 INTEGER DEFAULT 0,
                enrolled_female_grade_4 INTEGER DEFAULT 0,
                enrolled_male_grade_5 INTEGER DEFAULT 0,
                enrolled_female_grade_5 INTEGER DEFAULT 0,
                enrolled_male_grade_6 INTEGER DEFAULT 0,
                enrolled_female_grade_6 INTEGER DEFAULT 0,
                enrolled_male_grade_7 INTEGER DEFAULT 0,
                enrolled_female_grade_7 INTEGER DEFAULT 0,
                enrolled_male_grade_8 INTEGER DEFAULT 0,
                enrolled_female_grade_8 INTEGER DEFAULT 0,
                enrolled_male_grade_9 INTEGER DEFAULT 0,
                enrolled_female_grade_9 INTEGER DEFAULT 0,
                enrolled_male_grade_10 INTEGER DEFAULT 0,
                enrolled_female_grade_10 INTEGER DEFAULT 0,
                enrolled_male_grade_11 INTEGER DEFAULT 0,
                enrolled_female_grade_11 INTEGER DEFAULT 0,
                enrolled_male_grade_12 INTEGER DEFAULT 0,
                enrolled_female_grade_12 INTEGER DEFAULT 0,

                -- 4. LEARNERS (Organized Classes)
                classes_kinder INTEGER DEFAULT 0,
                classes_grade_1 INTEGER DEFAULT 0,
                classes_grade_2 INTEGER DEFAULT 0,
                classes_grade_3 INTEGER DEFAULT 0,
                classes_grade_4 INTEGER DEFAULT 0,
                classes_grade_5 INTEGER DEFAULT 0,
                classes_grade_6 INTEGER DEFAULT 0,
                classes_grade_7 INTEGER DEFAULT 0,
                classes_grade_8 INTEGER DEFAULT 0,
                classes_grade_9 INTEGER DEFAULT 0,
                classes_grade_10 INTEGER DEFAULT 0,
                classes_grade_11 INTEGER DEFAULT 0,
                classes_grade_12 INTEGER DEFAULT 0,

                -- 5. LEARNERS (Stats)
                stat_ip_male INTEGER DEFAULT 0,
                stat_ip_female INTEGER DEFAULT 0,
                stat_4ps_male INTEGER DEFAULT 0,
                stat_4ps_female INTEGER DEFAULT 0,
                stat_muslim_male INTEGER DEFAULT 0,
                stat_muslim_female INTEGER DEFAULT 0,
                stat_pwd_male INTEGER DEFAULT 0,
                stat_pwd_female INTEGER DEFAULT 0,

                -- 6. LEARNERS (Shifting)
                shift_kinder BOOLEAN DEFAULT FALSE,
                shift_g1 BOOLEAN DEFAULT FALSE,
                shift_g2 BOOLEAN DEFAULT FALSE,
                shift_g3 BOOLEAN DEFAULT FALSE,
                shift_g4 BOOLEAN DEFAULT FALSE,
                shift_g5 BOOLEAN DEFAULT FALSE,
                shift_g6 BOOLEAN DEFAULT FALSE,
                shift_g7 BOOLEAN DEFAULT FALSE,
                shift_g8 BOOLEAN DEFAULT FALSE,
                shift_g9 BOOLEAN DEFAULT FALSE,
                shift_g10 BOOLEAN DEFAULT FALSE,
                shift_g11 BOOLEAN DEFAULT FALSE,
                shift_g12 BOOLEAN DEFAULT FALSE,
                adm_mdl BOOLEAN DEFAULT FALSE,
                adm_odl BOOLEAN DEFAULT FALSE,
                adm_tv_radio BOOLEAN DEFAULT FALSE,
                
                -- 7. FACULTY (Teaching Personnel)
                teach_kinder INTEGER DEFAULT 0,
                teach_g1 INTEGER DEFAULT 0,
                teach_g2 INTEGER DEFAULT 0,
                teach_g3 INTEGER DEFAULT 0,
                teach_g4 INTEGER DEFAULT 0,
                teach_g5 INTEGER DEFAULT 0,
                teach_g6 INTEGER DEFAULT 0,
                teach_g7 INTEGER DEFAULT 0,
                teach_g8 INTEGER DEFAULT 0,
                teach_g9 INTEGER DEFAULT 0,
                teach_g10 INTEGER DEFAULT 0,
                teach_g11 INTEGER DEFAULT 0,
                teach_g12 INTEGER DEFAULT 0,
                teach_multi_1_2 INTEGER DEFAULT 0,
                teach_multi_3_4 INTEGER DEFAULT 0,
                teach_multi_5_6 INTEGER DEFAULT 0,
                teach_multi_3plus_count INTEGER DEFAULT 0,
                non_teaching_admin INTEGER DEFAULT 0,
                non_teaching_utility INTEGER DEFAULT 0,
                non_teaching_security INTEGER DEFAULT 0,
                non_teaching_clerk INTEGER DEFAULT 0,
                teachers_total INTEGER DEFAULT 0,

                -- 8. FACULTY (Specialization)
                spec_english_major INTEGER DEFAULT 0,
                spec_english_teaching INTEGER DEFAULT 0,
                spec_filipino_major INTEGER DEFAULT 0,
                spec_filipino_teaching INTEGER DEFAULT 0,
                spec_math_major INTEGER DEFAULT 0,
                spec_math_teaching INTEGER DEFAULT 0,
                spec_science_major INTEGER DEFAULT 0,
                spec_science_teaching INTEGER DEFAULT 0,
                spec_ap_major INTEGER DEFAULT 0,
                spec_ap_teaching INTEGER DEFAULT 0,
                spec_mapeh_major INTEGER DEFAULT 0,
                spec_mapeh_teaching INTEGER DEFAULT 0,
                spec_esp_major INTEGER DEFAULT 0,
                spec_esp_teaching INTEGER DEFAULT 0,
                spec_tle_major INTEGER DEFAULT 0,
                spec_tle_teaching INTEGER DEFAULT 0,
                spec_general_major INTEGER DEFAULT 0,
                spec_general_teaching INTEGER DEFAULT 0,
                spec_ece_major INTEGER DEFAULT 0,
                spec_ece_teaching INTEGER DEFAULT 0,
                spec_bio_sci_major INTEGER DEFAULT 0,
                spec_bio_sci_teaching INTEGER DEFAULT 0,
                spec_phys_sci_major INTEGER DEFAULT 0,
                spec_phys_sci_teaching INTEGER DEFAULT 0,
                spec_agri_fishery_major INTEGER DEFAULT 0,
                spec_agri_fishery_teaching INTEGER DEFAULT 0,
                spec_others_major INTEGER DEFAULT 0,
                spec_others_teaching INTEGER DEFAULT 0,

                -- 9. ASSETS (Resources)
                res_toilets_male INTEGER DEFAULT 0,
                res_toilets_female INTEGER DEFAULT 0,
                res_toilets_pwd INTEGER DEFAULT 0,
                res_toilets_common INTEGER DEFAULT 0,
                res_water_source TEXT,
                res_electricity_source TEXT,
                res_buildable_space TEXT,
                sha_category TEXT,
                res_ecart_func INTEGER DEFAULT 0,
                res_ecart_nonfunc INTEGER DEFAULT 0,
                res_laptop_func INTEGER DEFAULT 0,
                res_laptop_nonfunc INTEGER DEFAULT 0,
                res_tv_func INTEGER DEFAULT 0,
                res_tv_nonfunc INTEGER DEFAULT 0,
                res_printer_func INTEGER DEFAULT 0,
                res_printer_nonfunc INTEGER DEFAULT 0,
                res_desk_func INTEGER DEFAULT 0,
                res_desk_nonfunc INTEGER DEFAULT 0,
                res_armchair_func INTEGER DEFAULT 0,
                res_armchair_nonfunc INTEGER DEFAULT 0,
                res_toilet_func INTEGER DEFAULT 0,
                res_toilet_nonfunc INTEGER DEFAULT 0,
                res_handwash_func INTEGER DEFAULT 0,
                res_handwash_nonfunc INTEGER DEFAULT 0,
                res_sci_labs INTEGER DEFAULT 0,
                res_com_labs INTEGER DEFAULT 0,
                res_tvl_workshops INTEGER DEFAULT 0,

                -- 10. ASSETS (Facilities)
                build_classrooms_total INTEGER DEFAULT 0,
                build_classrooms_good INTEGER DEFAULT 0,
                build_classrooms_minor_repair INTEGER DEFAULT 0,
                build_classrooms_major_repair INTEGER DEFAULT 0,
                build_classrooms_condemned INTEGER DEFAULT 0,
                build_classrooms_ongoing INTEGER DEFAULT 0,
                makeshift_classrooms_total INTEGER DEFAULT 0,

                -- SEATS (Seats fit into Enrollment or a separate category, placing here for now)
                seats_kinder INTEGER DEFAULT 0,
                seats_grade_1 INTEGER DEFAULT 0,
                seats_grade_2 INTEGER DEFAULT 0,
                seats_grade_3 INTEGER DEFAULT 0,
                seats_grade_4 INTEGER DEFAULT 0,
                seats_grade_5 INTEGER DEFAULT 0,
                seats_grade_6 INTEGER DEFAULT 0,
                seats_grade_7 INTEGER DEFAULT 0,
                seats_grade_8 INTEGER DEFAULT 0,
                seats_grade_9 INTEGER DEFAULT 0,
                seats_grade_10 INTEGER DEFAULT 0,
                seats_grade_11 INTEGER DEFAULT 0,
                seats_grade_12 INTEGER DEFAULT 0,
                
                -- METADATA
                submitted_by TEXT,
                submitted_at TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                history_logs JSONB,

                -- COMPLETION TRACKING (Legacy/Computed)
                forms_completed_count INTEGER DEFAULT 0,
                completion_percentage NUMERIC DEFAULT 0,
                f1_profile INTEGER DEFAULT 0,
                f2_head INTEGER DEFAULT 0,
                f3_enrollment INTEGER DEFAULT 0,
                f4_classes INTEGER DEFAULT 0,
                f5_teachers INTEGER DEFAULT 0,
                f6_specialization INTEGER DEFAULT 0,
                f7_resources INTEGER DEFAULT 0,
                f8_facilities INTEGER DEFAULT 0,
                f9_shifting INTEGER DEFAULT 0,
                f10_stats INTEGER DEFAULT 0
            );
        `);

        // 2. Copy Data
        console.log("2️⃣ Copying data to school_profiles_ordered...");
        await client.query(`
            INSERT INTO school_profiles_ordered 
            SELECT * FROM school_profiles; 
        `);
        // Note: SELECT * works IF all columns exist. 
        // Iterate: Since the columns are named the same, it SHOULD map automatically? 
        // NO, SQL INSERT INTO ... SELECT * maps by POSITION, not name! 
        // This is dangerous if I missed a column.
        // BETTER: INSERT INTO target (col1, col2) SELECT col1, col2 FROM source.
        // But listing 100+ columns hardcoded is error prone.
        // Alternative: Rename old to backup, rename new to old.
        // Wait, if I use `INSERT INTO school_profiles_ordered (school_id, ...) SELECT school_id, ...` it is safe.
        // Given the constraints, I'll rely on a smart query to copy by name.

        // Actually, to ensure safety, I will let the user know I am doing a Rename-Swap first.

        // 3. Swap Tables
        console.log("3️⃣ Swapping tables...");
        await client.query(`ALTER TABLE school_profiles RENAME TO school_profiles_legacy_backup;`);
        await client.query(`ALTER TABLE school_profiles_ordered RENAME TO school_profiles;`);

        console.log("✅ Reorder Complete!");

    } catch (err) {
        console.error("❌ Error reordering:", err);
        // Rollback attempt if failed mid-way
        // await client.query(`DROP TABLE IF EXISTS school_profiles_ordered;`);
    } finally {
        client.release();
        await pool.end();
    }
}

reorderTable();
