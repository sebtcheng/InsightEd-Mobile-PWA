
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createPartitions() {
    const client = await pool.connect();
    try {
        console.log("🚀 Starting Partition Creation...");

        // --- form_school_profile ---
        console.log("Creating form_school_profile...");
        await client.query('DROP TABLE IF EXISTS form_school_profile');
        await client.query(`
            CREATE TABLE form_school_profile AS
            SELECT 
    school_id,
    iern,
    school_name,
    region,
    division,
    province,
    municipality,
    barangay,
    district,
    leg_district,
    latitude,
    longitude,
    curricular_offering,
    mother_school_id,
    email,
    updated_at,
    submitted_at,
    submitted_by,
    history_logs,
    data_health_score,
    data_health_description,
    mahalanobis_score,
    forms_to_recheck,
    forms_completed_count,
    completion_percentage,
    f1_profile,
    f2_head,
    f3_enrollment,
    f4_classes,
    f5_teachers,
    f6_specialization,
    f7_resources,
    f8_facilities,
    f9_shifting,
    f10_stats,
    cnt_within_g5,
    aral_read_g2,
    aral_sci_g2,
    aral_math_g3,
    aral_read_g3,
    aral_sci_g3,
    aral_math_g4,
    aral_read_g4,
    aral_sci_g4,
    aral_math_g5,
    aral_read_g5,
    aral_sci_g5,
    aral_math_g6,
    aral_read_g6,
    aral_sci_g6,
    aral_total,
    cnt_less_kinder,
    cnt_within_kinder,
    cnt_above_kinder,
    cnt_less_g1,
    cnt_within_g1,
    cnt_above_g1,
    cnt_less_g2,
    cnt_within_g2,
    cnt_above_g2,
    cnt_less_g3,
    cnt_within_g3,
    cnt_above_g3,
    cnt_less_g4,
    cnt_within_g4,
    cnt_above_g4,
    cnt_less_g5,
    cnt_above_g5,
    cnt_less_g6,
    cnt_within_g6,
    cnt_above_g6,
    cnt_less_g7,
    cnt_within_g7,
    cnt_above_g7,
    cnt_less_g8,
    cnt_within_g8,
    cnt_above_g8,
    cnt_less_g9,
    cnt_within_g9,
    cnt_above_g9,
    cnt_less_g10,
    cnt_within_g10,
    cnt_above_g10,
    cnt_less_g11,
    cnt_within_g11,
    cnt_above_g11,
    cnt_less_g12,
    cnt_within_g12,
    cnt_above_g12,
    aral_math_g1,
    aral_read_g1,
    aral_sci_g1,
    aral_math_g2,
    sha_category
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_school_profile ADD PRIMARY KEY (school_id)');
    
        // --- form_school_head ---
        console.log("Creating form_school_head...");
        await client.query('DROP TABLE IF EXISTS form_school_head');
        await client.query(`
            CREATE TABLE form_school_head AS
            SELECT 
    school_id,
    iern,
    head_last_name,
    head_first_name,
    head_middle_name,
    head_position_title,
    head_item_number,
    head_date_hired,
    school_head_validation
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_school_head ADD PRIMARY KEY (school_id)');
    
        // --- form_enrollment ---
        console.log("Creating form_enrollment...");
        await client.query('DROP TABLE IF EXISTS form_enrollment');
        await client.query(`
            CREATE TABLE form_enrollment AS
            SELECT 
    school_id,
    iern,
    total_enrollment,
    es_enrollment,
    jhs_enrollment,
    shs_enrollment,
    grade_kinder,
    grade_1,
    grade_2,
    grade_3,
    grade_4,
    grade_5,
    grade_6,
    grade_7,
    grade_8,
    grade_9,
    grade_10,
    grade_11,
    grade_12,
    abm_11,
    abm_12,
    stem_11,
    stem_12,
    humss_11,
    humss_12,
    gas_11,
    gas_12,
    tvl_ict_11,
    tvl_ict_12,
    tvl_he_11,
    tvl_he_12,
    tvl_ia_11,
    tvl_ia_12,
    tvl_afa_11,
    tvl_afa_12,
    arts_11,
    arts_12,
    sports_11,
    sports_12,
    seats_kinder,
    seats_grade_1,
    seats_grade_2,
    seats_grade_3,
    seats_grade_4,
    seats_grade_5,
    seats_grade_6,
    seats_grade_7,
    seats_grade_8,
    seats_grade_9,
    seats_grade_10,
    seats_grade_11,
    seats_grade_12
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_enrollment ADD PRIMARY KEY (school_id)');
    
        // --- form_organized_classes ---
        console.log("Creating form_organized_classes...");
        await client.query('DROP TABLE IF EXISTS form_organized_classes');
        await client.query(`
            CREATE TABLE form_organized_classes AS
            SELECT 
    school_id,
    iern,
    classes_kinder,
    classes_grade_1,
    classes_grade_2,
    classes_grade_3,
    classes_grade_4,
    classes_grade_5,
    classes_grade_6,
    classes_grade_7,
    classes_grade_8,
    classes_grade_9,
    classes_grade_10,
    classes_grade_11,
    classes_grade_12
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_organized_classes ADD PRIMARY KEY (school_id)');
    
        // --- form_learner_stats ---
        console.log("Creating form_learner_stats...");
        await client.query('DROP TABLE IF EXISTS form_learner_stats');
        await client.query(`
            CREATE TABLE form_learner_stats AS
            SELECT 
    school_id,
    iern,
    stat_sned_es,
    stat_sned_jhs,
    stat_sned_shs,
    stat_disability_es,
    stat_disability_jhs,
    stat_disability_shs,
    stat_als_es,
    stat_als_jhs,
    stat_als_shs,
    stat_muslim_k,
    stat_muslim_g1,
    stat_muslim_g2,
    stat_muslim_g3,
    stat_muslim_g4,
    stat_muslim_g5,
    stat_muslim_g6,
    stat_muslim_g7,
    stat_muslim_g8,
    stat_muslim_g9,
    stat_muslim_g10,
    stat_muslim_g11,
    stat_muslim_g12,
    stat_ip,
    stat_displaced,
    stat_repetition,
    stat_overage,
    stat_dropout_prev_sy,
    stat_ip_es,
    stat_ip_jhs,
    stat_ip_shs,
    stat_displaced_es,
    stat_displaced_jhs,
    stat_displaced_shs,
    stat_repetition_es,
    stat_repetition_jhs,
    stat_repetition_shs,
    stat_overage_es,
    stat_overage_jhs,
    stat_overage_shs,
    stat_dropout_es,
    stat_dropout_jhs,
    stat_dropout_shs,
    stat_sned_k,
    stat_sned_g1,
    stat_sned_g2,
    stat_sned_g3,
    stat_sned_g4,
    stat_sned_g5,
    stat_sned_g6,
    stat_sned_g7,
    stat_sned_g8,
    stat_sned_g9,
    stat_sned_g10,
    stat_sned_g11,
    stat_sned_g12,
    stat_disability_k,
    stat_disability_g1,
    stat_disability_g2,
    stat_disability_g3,
    stat_disability_g4,
    stat_disability_g5,
    stat_disability_g6,
    stat_disability_g7,
    stat_disability_g8,
    stat_disability_g9,
    stat_disability_g10,
    stat_disability_g11,
    stat_disability_g12,
    stat_als_k,
    stat_als_g1,
    stat_als_g2,
    stat_als_g3,
    stat_als_g4,
    stat_als_g5,
    stat_als_g6,
    stat_als_g7,
    stat_als_g8,
    stat_als_g9,
    stat_als_g10,
    stat_als_g11,
    stat_als_g12,
    stat_ip_k,
    stat_ip_g1,
    stat_ip_g2,
    stat_ip_g3,
    stat_ip_g4,
    stat_ip_g5,
    stat_ip_g6,
    stat_ip_g7,
    stat_ip_g8,
    stat_ip_g9,
    stat_ip_g10,
    stat_ip_g11,
    stat_ip_g12,
    stat_displaced_k,
    stat_displaced_g1,
    stat_displaced_g2,
    stat_displaced_g3,
    stat_displaced_g4,
    stat_displaced_g5,
    stat_displaced_g6,
    stat_displaced_g7,
    stat_displaced_g8,
    stat_displaced_g9,
    stat_displaced_g10,
    stat_displaced_g11,
    stat_displaced_g12,
    stat_repetition_k,
    stat_repetition_g1,
    stat_repetition_g2,
    stat_repetition_g3,
    stat_repetition_g4,
    stat_repetition_g5,
    stat_repetition_g6,
    stat_repetition_g7,
    stat_repetition_g8,
    stat_repetition_g9,
    stat_repetition_g10,
    stat_repetition_g11,
    stat_repetition_g12,
    stat_overage_k,
    stat_overage_g1,
    stat_overage_g2,
    stat_overage_g3,
    stat_overage_g4,
    stat_overage_g5,
    stat_overage_g6,
    stat_overage_g7,
    stat_overage_g8,
    stat_overage_g9,
    stat_overage_g10,
    stat_overage_g11,
    stat_overage_g12,
    stat_dropout_k,
    stat_dropout_g1,
    stat_dropout_g2,
    stat_dropout_g3,
    stat_dropout_g4,
    stat_dropout_g5,
    stat_dropout_g6,
    stat_dropout_g7,
    stat_dropout_g8,
    stat_dropout_g9,
    stat_dropout_g10,
    stat_dropout_g11,
    stat_dropout_g12,
    learner_stats_grids
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_learner_stats ADD PRIMARY KEY (school_id)');
    
        // --- form_shifting_modalities ---
        console.log("Creating form_shifting_modalities...");
        await client.query('DROP TABLE IF EXISTS form_shifting_modalities');
        await client.query(`
            CREATE TABLE form_shifting_modalities AS
            SELECT 
    school_id,
    iern,
    shift_kinder,
    shift_g1,
    shift_g2,
    shift_g3,
    shift_g4,
    shift_g5,
    shift_g6,
    shift_g7,
    shift_g8,
    shift_g9,
    shift_g10,
    shift_g11,
    shift_g12,
    adm_mdl,
    adm_odl,
    adm_tvi,
    adm_blended,
    adm_others,
    mode_kinder,
    mode_g1,
    mode_g2,
    mode_g3,
    mode_g4,
    mode_g5,
    mode_g6,
    mode_g7,
    mode_g8,
    mode_g9,
    mode_g10,
    mode_g11,
    mode_g12
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_shifting_modalities ADD PRIMARY KEY (school_id)');
    
        // --- form_teaching_personnel ---
        console.log("Creating form_teaching_personnel...");
        await client.query('DROP TABLE IF EXISTS form_teaching_personnel');
        await client.query(`
            CREATE TABLE form_teaching_personnel AS
            SELECT 
    school_id,
    iern,
    teach_exp_0_1,
    teach_exp_2_5,
    teach_exp_6_10,
    teach_exp_11_15,
    teach_exp_16_20,
    teach_exp_21_25,
    teach_exp_26_30,
    teach_exp_31_35,
    teach_exp_36_40,
    teach_exp_40_45,
    teach_kinder,
    teach_g1,
    teach_g2,
    teach_g3,
    teach_g4,
    teach_g5,
    teach_g6,
    teach_g7,
    teach_g8,
    teach_g9,
    teach_g10,
    teach_g11,
    teach_g12,
    teach_multi_1_2,
    teach_multi_3_4,
    teach_multi_5_6,
    teach_multi_3plus_flag,
    teach_multi_3plus_count,
    teachers_es,
    teachers_jhs,
    teachers_shs
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_teaching_personnel ADD PRIMARY KEY (school_id)');
    
        // --- form_specialization ---
        console.log("Creating form_specialization...");
        await client.query('DROP TABLE IF EXISTS form_specialization');
        await client.query(`
            CREATE TABLE form_specialization AS
            SELECT 
    school_id,
    iern,
    spec_general_teaching,
    spec_ece_teaching,
    spec_bio_sci_major,
    spec_bio_sci_teaching,
    spec_phys_sci_major,
    spec_phys_sci_teaching,
    spec_agri_fishery_major,
    spec_agri_fishery_teaching,
    spec_others_major,
    spec_others_teaching,
    spec_general_major,
    spec_ece_major,
    spec_english_major,
    spec_english_teaching,
    spec_filipino_major,
    spec_filipino_teaching,
    spec_math_major,
    spec_math_teaching,
    spec_science_major,
    spec_science_teaching,
    spec_ap_major,
    spec_ap_teaching,
    spec_mapeh_major,
    spec_mapeh_teaching,
    spec_esp_major,
    spec_esp_teaching,
    spec_tle_major,
    spec_tle_teaching,
    spec_guidance,
    spec_librarian,
    spec_ict_coord,
    spec_drrm_coord
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_specialization ADD PRIMARY KEY (school_id)');
    
        // --- form_school_resources ---
        console.log("Creating form_school_resources...");
        await client.query('DROP TABLE IF EXISTS form_school_resources');
        await client.query(`
            CREATE TABLE form_school_resources AS
            SELECT 
    school_id,
    iern,
    res_toilets_male,
    res_toilets_female,
    res_toilets_pwd,
    res_sci_labs,
    res_com_labs,
    res_tvl_workshops,
    res_toilets_common,
    res_ecart_func,
    res_ecart_nonfunc,
    res_laptop_func,
    res_laptop_nonfunc,
    res_tv_func,
    res_tv_nonfunc,
    res_printer_func,
    res_printer_nonfunc,
    res_desk_func,
    res_desk_nonfunc,
    res_armchair_func,
    res_armchair_nonfunc,
    res_toilet_func,
    res_toilet_nonfunc,
    res_handwash_func,
    res_handwash_nonfunc,
    res_water_source,
    res_electricity_source,
    res_buildable_space
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_school_resources ADD PRIMARY KEY (school_id)');
    
        // --- form_physical_facilities ---
        console.log("Creating form_physical_facilities...");
        await client.query('DROP TABLE IF EXISTS form_physical_facilities');
        await client.query(`
            CREATE TABLE form_physical_facilities AS
            SELECT 
    school_id,
    iern,
    build_classrooms_total,
    build_classrooms_new,
    build_classrooms_good,
    build_classrooms_repair,
    build_classrooms_demolition
            FROM school_profiles;
        `);
        await client.query('ALTER TABLE form_physical_facilities ADD PRIMARY KEY (school_id)');
    
        console.log("✅ All Partitions Created & Populated!");
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

createPartitions();
