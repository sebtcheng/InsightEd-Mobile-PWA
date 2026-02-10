
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from scipy.stats import zscore, chi2
from sklearn.covariance import MinCovDet
import sys

# Database Connection
DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def connect_and_load_data():
    print("Connecting to database...")
    try:
        engine = create_engine(DB_CONNECTION_STRING)
        # Load all columns to scan for correlations, but focus on school_profiles
        query = "SELECT * FROM school_profiles"
        df = pd.read_sql(query, engine)
        print(f"Successfully loaded {len(df)} records.")
        return df, engine
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None, None

def scan_correlations(df, target_col='total_enrollment'):
    print(f"\nScanning for columns correlated with {target_col}...")
    
    # Select numeric columns only
    numeric_df = df.select_dtypes(include=[np.number])
    
    if target_col not in numeric_df.columns:
        print(f"Target column {target_col} not found or not numeric.")
        return []

    # Calculate correlation matrix
    correlations = numeric_df.corrwith(numeric_df[target_col]).abs().sort_values(ascending=False)
    
    print("Top 10 Correlated Columns:")
    print(correlations.head(10))
    
    return correlations.index.tolist()

def clean_and_impute(df):
    print("\nCleaning and Imputing Data...")
    
    # 1. Define Key Columns for Fraud Detection
    # Based on schema inspection:
    # Teachers: 'teachers_es', 'teachers_jhs', 'teachers_shs' -> combined to 'num_teachers'
    # Classrooms: 'build_classrooms_total' (or sum of good/repair/new if total is unreliable)
    # Toilets: 'res_toilets_female', 'res_toilets_male', 'res_toilets_common', 'res_toilets_pwd'
    # Furniture: 'res_desk_func', 'res_armchair_func', 'res_teacher_tables_good'
    
    # Helper to sum columns if they exist, treating NaN as 0
    def sum_cols(row, cols):
        total = 0
        for c in cols:
            if c in row.index and pd.notnull(row[c]):
                 # Clean non-numeric garbage if any (though read_sql usually handles types well)
                 try:
                     val = float(row[c])
                     total += val
                 except:
                     pass
        return total

    # Teachers
    # 1. Summary Columns
    summary_t_cols = ['teachers_es', 'teachers_jhs', 'teachers_shs']
    summary_teacher_sum = df.apply(lambda x: sum_cols(x, summary_t_cols), axis=1)

    # 2. Granular Columns (Kinder, G1-G12, SPED, Multigrade)
    granular_t_cols = [
        'teach_kinder', 'teach_g1', 'teach_g2', 'teach_g3', 'teach_g4', 'teach_g5', 'teach_g6',
        'teach_g7', 'teach_g8', 'teach_g9', 'teach_g10', 'teach_g11', 'teach_g12',
        'teach_multi_1_2', 'teach_multi_3_4', 'teach_multi_5_6', 'teach_multi_3plus_count'
    ]
    granular_teacher_sum = df.apply(lambda x: sum_cols(x, granular_t_cols), axis=1)
    
    # Use MAX of summary or granular to capture the most data
    # NEW: Also include Specialization teachers as a valid source of "Teacher Count" if profile is missing
    # (Sometimes users fill out specialization but not the main profile)
    
    # Pre-calculate specialization total for use here
    spec_cols_temp = [
        'spec_english_teaching', 'spec_filipino_teaching', 'spec_math_teaching',
        'spec_science_teaching', 'spec_ap_teaching', 'spec_mapeh_teaching',
        'spec_esp_teaching', 'spec_tle_teaching', 'spec_guidance', 'spec_librarian',
        'spec_ict_coord', 'spec_drrm_coord', 'spec_general_teaching', 'spec_ece_teaching',
        'spec_bio_sci_teaching', 'spec_phys_sci_teaching', 'spec_agri_fishery_teaching',
        'spec_others_teaching'
    ]
    spec_teacher_sum = df.apply(lambda x: sum_cols(x, spec_cols_temp), axis=1)

    # FIXED: Remove Specialization columns from teacher count (values represent learners/load, not teachers)
    # df['num_teachers'] = np.maximum.reduce([summary_teacher_sum, granular_teacher_sum, spec_teacher_sum])
    df['num_teachers'] = np.maximum(summary_teacher_sum, granular_teacher_sum)
    
    # Classrooms
    # distinct from 'build_classrooms_total' which might be pre-calculated
    # ROBUST FIX: Trust 'build_classrooms_total' IF it exists AND is > 0.
    # If it exists but is 0, check the components (good + repair + new).
    # Take the MAXIMUM of Total vs Sum(Components) to be safe.
    
    classroom_components = ['build_classrooms_good', 'build_classrooms_repair', 'build_classrooms_new']
    component_sum = df.apply(lambda x: sum_cols(x, classroom_components), axis=1)

    if 'build_classrooms_total' in df.columns:
         total_reported = pd.to_numeric(df['build_classrooms_total'], errors='coerce').fillna(0)
         df['num_classrooms'] = np.maximum(total_reported, component_sum)
    else:
         df['num_classrooms'] = component_sum

    # Toilets
    toilet_cols = ['res_toilets_female', 'res_toilets_male', 'res_toilets_common', 'res_toilets_pwd']
    df['num_toilets'] = df.apply(lambda x: sum_cols(x, toilet_cols), axis=1)
    
    # Furniture (Desks + Armchairs) - Keeping for PFR
    furniture_cols = ['res_desk_func', 'res_armchair_func']
    df['num_furniture'] = df.apply(lambda x: sum_cols(x, furniture_cols), axis=1)

    # NEW: Seats (Kinder - G12)
    seats_cols = [
        'seats_kinder', 'seats_grade_1', 'seats_grade_2', 'seats_grade_3', 'seats_grade_4', 'seats_grade_5',
        'seats_grade_6', 'seats_grade_7', 'seats_grade_8', 'seats_grade_9', 'seats_grade_10', 
        'seats_grade_11', 'seats_grade_12'
    ]
    df['num_seats_granular'] = df.apply(lambda x: sum_cols(x, seats_cols), axis=1)

    # NEW: Teacher Experience
    exp_cols = [
        'teach_exp_0_1', 'teach_exp_2_5', 'teach_exp_6_10', 'teach_exp_11_15', 'teach_exp_16_20',
        'teach_exp_21_25', 'teach_exp_26_30', 'teach_exp_31_35', 'teach_exp_36_40', 'teach_exp_40_45'
    ]
    df['num_teachers_exp'] = df.apply(lambda x: sum_cols(x, exp_cols), axis=1)

    # ---------------------------------------------------------
    # NEW AGGREGATIONS FOR FRAUD RULES (User Request)
    # ---------------------------------------------------------
    
    # 1. Total Sections (Classes)
    classes_cols = [
        'classes_kinder', 'classes_grade_1', 'classes_grade_2', 'classes_grade_3',
        'classes_grade_4', 'classes_grade_5', 'classes_grade_6', 'classes_grade_7',
        'classes_grade_8', 'classes_grade_9', 'classes_grade_10', 'classes_grade_11',
        'classes_grade_12'
    ]
    df['total_sections'] = df.apply(lambda x: sum_cols(x, classes_cols), axis=1)

    # 2. Total Specialization Teachers (from Spec Form)
    spec_cols = [
        'spec_english_teaching', 'spec_filipino_teaching', 'spec_math_teaching',
        'spec_science_teaching', 'spec_ap_teaching', 'spec_mapeh_teaching',
        'spec_esp_teaching', 'spec_tle_teaching', 'spec_guidance', 'spec_librarian',
        'spec_ict_coord', 'spec_drrm_coord', 'spec_general_teaching', 'spec_ece_teaching',
        'spec_bio_sci_teaching', 'spec_phys_sci_teaching', 'spec_agri_fishery_teaching',
        'spec_others_teaching'
    ]
    df['total_specialization_teachers'] = df.apply(lambda x: sum_cols(x, spec_cols), axis=1)

    # 2. Impute Zero/Missing Values with Median (to avoid skewing stats)
    # logic: If enrollment > 0 but resource is 0, it's likely missing data, not 0 resources.
    # We replace 0 with Median of NON-ZERO values for the calculation of outliers,
    # BUT we flag "Missing Data" separately.
    
    for col in ['num_teachers', 'num_classrooms', 'num_toilets', 'num_furniture', 'num_seats_granular']:
        median_val = df[df[col] > 0][col].median()
        if pd.isna(median_val): median_val = 1 # Fallback
        
        # Create a specific column for analysis that has no zeros
        df[f'{col}_imputed'] = df[col].replace(0, median_val)
        df[f'{col}_imputed'] = df[f'{col}_imputed'].fillna(median_val)

    # Enrollment Imputation (rare, but avoiding div/0)
    median_enrollment = df[df['total_enrollment'] > 0]['total_enrollment'].median()
    if pd.isna(median_enrollment): median_enrollment = 100
    
    df['total_enrollment_imputed'] = df['total_enrollment'].replace(0, median_enrollment)
    df['total_enrollment_imputed'] = df['total_enrollment_imputed'].fillna(median_enrollment)

    return df

def feature_engineering(df):
    print("\nFeature Engineering: Efficiency Ratios...")
    
    # 1. Resource Intensity Ratios (Inverse of Efficiency to avoid small decimals)
    # Pupil-Resource Ratios
    
    # PTR: Pupil-Teacher Ratio
    df['ptr'] = df['total_enrollment_imputed'] / df['num_teachers_imputed']
    
    # PCR: Pupil-Classroom Ratio
    df['pcr'] = df['total_enrollment_imputed'] / df['num_classrooms_imputed']
    
    # PTrR: Pupil-Toilet Ratio
    df['ptrr'] = df['total_enrollment_imputed'] / df['num_toilets_imputed']
    
    # PFR: Pupil-Furniture Ratio
    df['pfr'] = df['total_enrollment_imputed'] / df['num_furniture_imputed']
    
    # NEW: Pupil-Seat Ratio (Using granular seats)
    df['pupil_seat_ratio'] = df['total_enrollment_imputed'] / df['num_seats_granular_imputed']

    # Handle infinite/nan just in case
    ratio_cols = ['ptr', 'pcr', 'ptrr', 'pfr', 'pupil_seat_ratio']
    for col in ratio_cols:
        df[col] = df[col].replace([np.inf, -np.inf], np.nan)
        df[col] = df[col].fillna(df[col].median())
        
    return df

def detect_univariate_outliers(df):
    print("\nFraud Detection L1: Univariate Z-Scores...")
    
    ratios_map = {
        'ptr': 'Pupil-Teacher Ratio',
        'pcr': 'Pupil-Classroom Ratio',
        'ptrr': 'Pupil-Toilet Ratio',
        'pfr': 'Pupil-Furniture Ratio',
        'pupil_seat_ratio': 'Pupil-Seat Ratio'
    }
    z_threshold = 3.0
    
    df['univariate_flags'] = ""
    
    for col, name in ratios_map.items():
        # Calculate Z-score
        # Use robust stats: (x - median) / MAD * 0.6745? 
        # Standard Z-score is requested, but robust is better for outliers.
        # Stick to standard Z-score as per request "Calculate the Z-Score", 
        # but mentioning Median imputation earlier helps.
        
        # Actually, let's use Modified Z-Score for robustness if standard deviation is skewed by massive outliers
        median = df[col].median()
        mad = np.median(np.abs(df[col] - median))
        
        if mad == 0:
            # Fallback to standard Z
            mean = df[col].mean()
            std = df[col].std()
            z_scores = (df[col] - mean) / std
        else:
            # Modified Z = 0.6745 * (x - median) / MAD
            z_scores = 0.6745 * (df[col] - median) / mad
            
        df[f'z_{col}'] = z_scores
        
        # Flagging
        # High Positive Z = Overcrowding (Too many students for resource) -> Under-reporting resources? Or Over-reporting students?
        # High Negative Z = Surplus (Too many resources for students) -> Ghost Schools / Over-reporting resources?
        
        conditions = [
            (df[f'z_{col}'] > z_threshold, f"Abnormal {name} detected (High). Please verify student count and resource data."),
            (df[f'z_{col}'] < -z_threshold, f"Abnormal {name} detected (Low). Please verify student count and resource data.")
        ]
        
        for mask, msg in conditions:
             df.loc[mask, 'univariate_flags'] += msg + "; "

    return df

def detect_multivariate_outliers(df):
    print("\nFraud Detection L2: Multivariate Mahalanobis (MCD)...")
    
    # Features for multivariate analysis
    features = ['total_enrollment_imputed', 'num_teachers_imputed', 'num_classrooms_imputed', 'num_toilets_imputed']
    
    # 1. Log1p Transform to normalize skewed size distributions
    X = df[features].apply(np.log1p)
    
    # 2. Robust Covariance (MinCovDet)
    # support_fraction: proportion of points to be included in the support of the raw MCD estimate
    # default is None, which implies (n_samples + n_features + 1) / 2
    try:
        mcd = MinCovDet(random_state=42)
        mcd.fit(X)
        
        # 3. Calculate Mahalanobis Distance
        # mcd.mahalanobis(X) returns squared Mahalanobis distance
        df['mahalanobis_sq'] = mcd.mahalanobis(X)
        df['mahalanobis_dist'] = np.sqrt(df['mahalanobis_sq'])
        
        # 4. Determine Threshold
        # For d=4 degrees of freedom, cut-off is Chi-square distribution
        # p=0.001 -> 18.47
        threshold = chi2.ppf(0.999, df=len(features)) 
        print(f"Mahalanobis Threshold (p=0.001, df={len(features)}): {threshold:.2f}")
        
    except Exception as e:
        print(f"Error in MCD calculation: {e}")
        df['mahalanobis_dist'] = 0
        threshold = 999

    # Flagging
    df['multivariate_flag'] = df.apply(
        lambda row: f"Data pattern inconsistency detected. The combination of enrollment and resources is unusual." 
        if row['mahalanobis_sq'] > threshold else "", axis=1
    )
    
    return df

def audit_data_health_completeness(df):
    print("\nAuditing Data Completeness (Zero Checks)...")
    
    # Check for actual reported zeros (not imputed)
    # If Enrollment > 0 but Teacher = 0 -> Critical Missing Data
    
    def zero_check(row):
        issues = []
        if row['total_enrollment'] > 0:
            if row['num_teachers'] == 0:
                issues.append("Critical missing data. No teachers have been reported in the School Profile.")
            if row['num_classrooms'] == 0:
                issues.append("Critical missing data. No classrooms have been reported in the School Profile.")
            if row['num_toilets'] == 0:
                issues.append("Critical missing data. No toilets have been reported in the Physical Facilities.")
        
        # NEW: Teacher Experience Consistency Check
        # Allow 10% variance or +/- 2 teachers difference (to account for admin staff vs teaching staff)
        teachers_reported = row['num_teachers']
        teachers_exp = row['num_teachers_exp']
        
        if teachers_reported > 0 and teachers_exp > 0:
             diff = abs(teachers_reported - teachers_exp)
             allowable_diff = max(2, teachers_reported * 0.15) # 15% discrepancy allowed
             
             if diff > allowable_diff:
                 issues.append(f"Teacher data inconsistency. The total teachers reported does not match the experience breakdown.")
        
        # Missing Experience Data
        if teachers_reported > 5 and teachers_exp == 0:
             issues.append("Teacher experience data is missing.")

        return "; ".join(issues)

    df['completeness_issues'] = df.apply(zero_check, axis=1)
    
    # ---------------------------------------------------------
    # NEW FRAUD RULES (User Request)
    # ---------------------------------------------------------
    print("\nChecking Consistency Rules (User Defined)...")

    def check_consistency(row):
        flags = []
        
        # Rule 1: Class Size Integrity (Section Sum vs Reported Sections)
        # We need to iterate over grades. This is complex in a row function without hardcoding.
        # Let's check a few key grades to avoid performance hit on huge loops if any.
        # Actually, python iteration on columns is fine.
        grades = [
            ('kinder', 'cnt_less_kinder', 'cnt_within_kinder', 'cnt_above_kinder', 'classes_kinder'),
            ('g1', 'cnt_less_g1', 'cnt_within_g1', 'cnt_above_g1', 'classes_grade_1'),
            ('g6', 'cnt_less_g6', 'cnt_within_g6', 'cnt_above_g6', 'classes_grade_6'),
            ('g10', 'cnt_less_g10', 'cnt_within_g10', 'cnt_above_g10', 'classes_grade_10'),
            ('g12', 'cnt_less_g12', 'cnt_within_g12', 'cnt_above_g12', 'classes_grade_12')
        ]
        
        for g_name, c_less, c_within, c_above, c_total in grades:
            # Check if columns exist
            if c_total in row.index and c_less in row.index:
                reported_total = row.get(c_total, 0)
                standards_sum = row.get(c_less, 0) + row.get(c_within, 0) + row.get(c_above, 0)
                
                # Verify match (exact)
                if reported_total > 0 and standards_sum != reported_total:
                     flags.append(f"Section count mismatch. The total sections reported for {g_name.upper()} do not match the detailed class size breakdown.")

        # Rule 2: Sections vs Students (Avg Class Size Risk)
        # Expect 15-60 students per section.
        if row['total_sections'] > 0 and row['total_enrollment'] > 0:
            avg_class_size = row['total_enrollment'] / row['total_sections']
            if avg_class_size > 65:
                # flags.append(f"Severe Overcrowding (Avg {int(avg_class_size)} students/section)")
                flags.append(f"Data entry error suspected. The ratio of students to sections is suspiciously high.")
            elif avg_class_size < 15 and row['total_enrollment'] > 50: # Ignore very small schools
                # flags.append(f"Under-utilized Sections (Avg {int(avg_class_size)} students/section)")
                flags.append(f"Data entry error suspected. The ratio of students to sections is suspiciously low.")

        # Rule 3: Teachers vs Specialization (Consistency)
        # Compare 'num_teachers' (School Profile) vs 'total_specialization_teachers'
        t_profile = row['num_teachers']
        t_spec = row['total_specialization_teachers']
        
        if t_profile > 0 and t_spec > 0:
             # Allow some variance (e.g. non-teaching staff in profile, or multi-specialization)
             # If Spec count is drastically lower -> Missing Specialization data
             if t_spec < (t_profile * 0.5):
                 # flags.append(f"Incomplete Specialization Data (Profile: {int(t_profile)}, Spec Form: {int(t_spec)})")
                 flags.append("Specialization form incomplete. The number of specialized teachers is much lower than the total teachers reported.")
             # If Spec count is drastically higher -> Double counting or wrong entry
             elif t_spec > (t_profile * 1.5):
                 # flags.append(f"Specialization Count Mismatch (Profile: {int(t_profile)}, Spec Form: {int(t_spec)})")
                 flags.append("Specialization count mismatch. The number of specialized teachers exceeds the total teachers reported.")

        # Rule 4: Classrooms vs Learners (Student-Classroom Ratio)
        # Standard 1:45. Critical > 1:60.
        if row['num_classrooms'] > 0 and row['total_enrollment'] > 0:
            scr = row['total_enrollment'] / row['num_classrooms']
            if scr > 70:
                 # flags.append(f"Critical Classroom Shortage (1:{int(scr)})")
                 flags.append("Potential data error. The reported number of classrooms is too low for the total enrollment.")
        
        return "; ".join(flags)

    df['consistency_flags'] = df.apply(check_consistency, axis=1)
    
    # Merge consistency flags into completeness_issues or univariate_flags?
    # Let's append to completeness_issues so they appear in "Reasons"
    def merge_flags(row):
        existing = row['completeness_issues']
        new_flags = row['consistency_flags']
        
        parts = []
        if existing: parts.append(existing)
        if new_flags: parts.append(new_flags)
        return "; ".join(parts)

    df['completeness_issues'] = df.apply(merge_flags, axis=1)
    return df

def calculate_final_scores(df):
    print("\nCalculating Final Data Health Scores...")
    
    # Base Score: 100
    # Deductions:
    # - Completeness Issue: -25 each (Teachers/Classrooms/Toilets)
    # - Univariate Outlier: -15 each (Extreme Ratios)
    # - Multivariate Outlier: -20 (Inconsistent Mix)
    
    def score_row(row):
        score = 100
        reasons = []
        
        # 1. Completeness
        if row['completeness_issues']:
            issues = row['completeness_issues'].split('; ')
            score -= (25 * len(issues))
            reasons.extend(issues)
            
        # 2. Multivariate
        if row['multivariate_flag']:
            score -= 20
            # reasons.append(row['multivariate_flag']) # REMOVED per user request
            # We still deduct score, but don't clutter the forms_to_recheck text
            
        # 3. Univariate (Targeted)
        if row['univariate_flags']:
            flags = [f for f in row['univariate_flags'].split('; ') if f]
            # Cap deduction to avoid negative
            deduction = min(30, 10 * len(flags)) 
            score -= deduction
            reasons.extend(flags)
        
        # Floor
        score = max(5, score)
        
        # Description - STRICTER per user feedback
        # Excellent = 100 (Perfect, no issues)
        # Good = 80-99 (Minor issues like 1 outlier)
        # Fair = 50-79
        # Critical < 50
        
        if score == 100: desc = "Excellent"
        elif score >= 80: desc = "Good"
        elif score >= 50: desc = "Fair"
        else: desc = "Critical"
        
        # Formatting Reasons
        reasons_str = "; ".join(reasons)
        if not reasons_str: reasons_str = "None"
        
        return pd.Series([score, desc, reasons_str])

    score_cols = df.apply(score_row, axis=1)
    score_cols.columns = ['data_health_score', 'data_health_description', 'forms_to_recheck']
    
    # NEW: School Head Validation
    # Logic:
    # 1. Algorithmic: True if Score >= 80 ("Excellent" or "Good")
    # 2. Manual Override: If 'school_head_validation' is ALREADY True in DB, keep it True.
    
    algo_validation = score_cols['data_health_description'].isin(["Excellent", "Good"])
    
    if 'school_head_validation' in df.columns:
        # Combine: Keep True if it was already True OR if Algorithm says it's Good
        # We assume empty/NaN is False
        existing_validation = df['school_head_validation'].fillna(False).infer_objects(copy=False).astype(bool)
        df['school_head_validation'] = existing_validation | algo_validation
    else:
        # First run or column missing
        df['school_head_validation'] = algo_validation
    
    # Drop existing columns to avoid duplicates
    cols_to_drop = [c for c in score_cols.columns if c in df.columns]
    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)
        
    df = pd.concat([df, score_cols], axis=1)
    return df

def update_database(df, engine, target_school_id=None):
    print("\nUpdating Database...")

    try:
        # Create columns if they don't exist (One-time setup or fast check)
        # For optimization, we could skip this if we know schema is stable, 
        # but it's relatively cheap compared to bulk updates.
        with engine.connect() as conn:
            cols = [
                ("data_health_score", "FLOAT"),
                ("data_health_description", "TEXT"),
                ("forms_to_recheck", "TEXT"),
                ("mahalanobis_score", "FLOAT"),
                ("school_head_validation", "BOOLEAN")
            ]
            for col_name, col_type in cols:
                conn.execute(text(f"ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
            conn.commit()
            
            # Prepare Data
            update_data = df[['school_id', 'data_health_score', 'data_health_description', 'forms_to_recheck', 'mahalanobis_dist', 'school_head_validation']].to_dict(orient='records')
            for d in update_data:
                d['mahalanobis_score'] = d.pop('mahalanobis_dist')

            # FILTER IF TARGETING SPECIFIC SCHOOL
            if target_school_id:
                print(f"Targeted Update: Filtering for School ID {target_school_id}")
                update_data = [d for d in update_data if str(d['school_id']) == str(target_school_id)]
                
                if not update_data:
                    print(f"Warning: Target school {target_school_id} not found in processed data.")
                    return

            # Execute Update
            stmt = text("""
                UPDATE school_profiles
                SET data_health_score = :data_health_score,
                    data_health_description = :data_health_description,
                    forms_to_recheck = :forms_to_recheck,
                    mahalanobis_score = :mahalanobis_score,
                    school_head_validation = :school_head_validation
                WHERE school_id = :school_id
            """)
            
            print(f"Executing update for {len(update_data)} records...")
            conn.execute(stmt, update_data)
            conn.commit()
            print("Database update completed.")
            
    except Exception as e:
        print(f"Failed to update database: {e}")

def update_school_summary_table(df, engine):
    print("\nUpdating School Summary Table...")
    
    try:
        # 1. Create Table if not exists
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS school_summary (
                    school_id VARCHAR(50) PRIMARY KEY,
                    school_name TEXT,
                    iern VARCHAR(50),
                    region VARCHAR(50),
                    division VARCHAR(100),
                    district VARCHAR(100),
                    total_teachers INT DEFAULT 0,
                    total_teaching_experience INT DEFAULT 0,
                    total_specialized_teachers INT DEFAULT 0,
                    total_classrooms INT DEFAULT 0,
                    total_seats INT DEFAULT 0,
                    total_learners INT DEFAULT 0,
                    total_toilets INT DEFAULT 0,
                    total_furniture INT DEFAULT 0,
                    total_als_learners INT DEFAULT 0,
                    total_sped_learners INT DEFAULT 0,
                    total_muslim_learners INT DEFAULT 0,
                    total_organized_classes INT DEFAULT 0,
                    total_school_resources INT DEFAULT 0,
                    data_health_score FLOAT DEFAULT 0,
                    data_health_description VARCHAR(50),
                    issues TEXT,
                    flag_outlier_ptr BOOLEAN DEFAULT FALSE,
                    flag_outlier_pcr BOOLEAN DEFAULT FALSE,
                    flag_outlier_psr BOOLEAN DEFAULT FALSE,
                    flag_outlier_ptorr BOOLEAN DEFAULT FALSE,
                    flag_outlier_pfr BOOLEAN DEFAULT FALSE,
                    flag_zero_teachers BOOLEAN DEFAULT FALSE,
                    flag_zero_classrooms BOOLEAN DEFAULT FALSE,
                    flag_zero_seats BOOLEAN DEFAULT FALSE,
                    flag_zero_toilets BOOLEAN DEFAULT FALSE,
                    flag_zero_furniture BOOLEAN DEFAULT FALSE,
                    flag_zero_resources BOOLEAN DEFAULT FALSE,
                    flag_zero_organized_classes BOOLEAN DEFAULT FALSE,
                    flag_anomaly_teachers BOOLEAN DEFAULT FALSE,
                    flag_anomaly_classrooms BOOLEAN DEFAULT FALSE,
                    flag_anomaly_seats BOOLEAN DEFAULT FALSE,
                    flag_anomaly_toilets BOOLEAN DEFAULT FALSE,
                    flag_anomaly_furniture BOOLEAN DEFAULT FALSE,
                    flag_anomaly_organized_classes BOOLEAN DEFAULT FALSE,
                    flag_exp_mismatch BOOLEAN DEFAULT FALSE,
                    flag_spec_mismatch BOOLEAN DEFAULT FALSE,
                    flag_zero_specialization BOOLEAN DEFAULT FALSE,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            # Ensure new columns exist (Migration)
            conn.execute(text("""
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS total_organized_classes INT DEFAULT 0;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS total_teaching_experience INT DEFAULT 0;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS total_specialized_teachers INT DEFAULT 0;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS total_school_resources INT DEFAULT 0;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS total_toilets INT DEFAULT 0;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS total_furniture INT DEFAULT 0;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS iern VARCHAR(50);
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS data_health_score FLOAT DEFAULT 0;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS data_health_description VARCHAR(50);
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS issues TEXT;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_outlier_ptr BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_outlier_pcr BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_outlier_psr BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_outlier_ptorr BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_outlier_pfr BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_zero_teachers BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_zero_classrooms BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_zero_seats BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_zero_toilets BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_zero_furniture BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_zero_resources BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_zero_organized_classes BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_anomaly_teachers BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_anomaly_classrooms BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_anomaly_seats BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_anomaly_toilets BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_anomaly_furniture BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_anomaly_organized_classes BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_exp_mismatch BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_exp_mismatch BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_spec_mismatch BOOLEAN DEFAULT FALSE;
                ALTER TABLE school_summary ADD COLUMN IF NOT EXISTS flag_zero_specialization BOOLEAN DEFAULT FALSE;
                
                ALTER TABLE school_summary DROP COLUMN IF EXISTS flag_spec_exceeds;
                
                ALTER TABLE school_summary DROP COLUMN IF EXISTS total_als_learners;
                ALTER TABLE school_summary DROP COLUMN IF EXISTS total_sped_learners;
                ALTER TABLE school_summary DROP COLUMN IF EXISTS total_muslim_learners;
            """))
            conn.commit()

        # 2. Calculate Aggregates
        
        # Helper to sum columns if they exist
        def sum_cols_safe(row, cols):
            total = 0
            for c in cols:
                if c in row.index and pd.notnull(row[c]):
                    try:
                        total += float(row[c])
                    except:
                        pass
            return int(total)

        # ALS (Alternative Learning System)
        # REMOVED per user request
        
        # SPED (Special Education / SNED / Disability)
        # REMOVED per user request

        # Muslim / ALIVE Learners
        # REMOVED per user request
        
        # Teaching Experience
        experience_cols = [
            'teach_exp_0_1', 'teach_exp_2_5', 'teach_exp_6_10',
            'teach_exp_11_15', 'teach_exp_16_20', 'teach_exp_21_25',
            'teach_exp_26_30', 'teach_exp_31_35', 'teach_exp_36_40',
            'teach_exp_40_45'
        ]
        


        # Specialized Teachers (Majors - excluding teaching load)
        specialized_cols = [
            'spec_general_major', 'spec_ece_major', 'spec_english_major', 'spec_filipino_major',
            'spec_math_major', 'spec_science_major', 'spec_ap_major', 'spec_mapeh_major',
            'spec_esp_major', 'spec_tle_major', 'spec_bio_sci_major', 'spec_phys_sci_major',
            'spec_agri_fishery_major', 'spec_others_major'
        ]

        # Organized Classes
        classes_cols = [
            'classes_kinder', 'classes_grade_1', 'classes_grade_2', 'classes_grade_3',
            'classes_grade_4', 'classes_grade_5', 'classes_grade_6', 'classes_grade_7',
            'classes_grade_8', 'classes_grade_9', 'classes_grade_10', 'classes_grade_11',
            'classes_grade_12'
        ]

        # Toilets (for Pupil-Toilet Ratio)
        toilet_cols = ['res_toilets_female', 'res_toilets_male', 'res_toilets_common', 'res_toilets_pwd']
        
        # Furniture (for Pupil-Furniture Ratio)
        furniture_cols = ['res_desk_func', 'res_armchair_func']

        # School Resources (Inventory)
        # Includes Functional items: Labs, Furniture, Sanitation, Devices
        resource_cols = [
            # Labs
            'res_sci_labs', 'res_com_labs', 'res_tvl_workshops',
            # Furniture
            'res_desk_func', 'res_armchair_func',
            # Sanitation
            'res_toilets_male', 'res_toilets_female', 'res_toilets_pwd', 'res_toilets_common', 'res_handwash_func',
            # Devices/Equipment
            'res_ecart_func', 'res_laptop_func', 'res_tv_func', 'res_printer_func', 'res_toilet_func' 
        ]
        
        # Calculate
        summary_df = pd.DataFrame()
        summary_df['school_id'] = df['school_id']
        summary_df['school_name'] = df['school_name'] if 'school_name' in df.columns else ""
        summary_df['iern'] = df['iern'] if 'iern' in df.columns else ""
        summary_df['region'] = df['region'] if 'region' in df.columns else ""
        summary_df['division'] = df['division'] if 'division' in df.columns else ""
        summary_df['district'] = df['district'] if 'district' in df.columns else ""
        
        # Use simple integer casting for existing calculated floats
        summary_df['total_teachers'] = df['num_teachers'].fillna(0).astype(int)
        summary_df['total_teaching_experience'] = df.apply(lambda x: sum_cols_safe(x, experience_cols), axis=1)
        summary_df['total_specialized_teachers'] = df.apply(lambda x: sum_cols_safe(x, specialized_cols), axis=1)
        summary_df['total_classrooms'] = df['num_classrooms'].fillna(0).astype(int)
        summary_df['total_seats'] = df['num_seats_granular'].fillna(0).astype(int)
        summary_df['total_learners'] = df['total_enrollment'].fillna(0).astype(int)
        summary_df['total_toilets'] = df.apply(lambda x: sum_cols_safe(x, toilet_cols), axis=1)
        summary_df['total_furniture'] = df.apply(lambda x: sum_cols_safe(x, furniture_cols), axis=1)
        
        # REMOVED per user request: als, sped, muslim calculations
        
        summary_df['total_organized_classes'] = df.apply(lambda x: sum_cols_safe(x, classes_cols), axis=1)
        summary_df['total_school_resources'] = df.apply(lambda x: sum_cols_safe(x, resource_cols), axis=1)
        

        # Net Learners (Removed)
        # summary_df['net_learners'] = summary_df['total_learners']

        # 3. Upsert into Database
        # We'll use a loop with ON CONFLICT UPDATE for postgres
        data_to_insert = summary_df.to_dict(orient='records')
        
        print(f"Syncing {len(data_to_insert)} records to school_summary...")
        
        # Batch insert/update
        with engine.connect() as conn:
            stmt = text("""
                INSERT INTO school_summary (
                    school_id, school_name, iern, region, division, district,
                    total_teachers, total_classrooms, total_seats,
                    total_learners, total_toilets, total_furniture, total_organized_classes, total_teaching_experience, total_specialized_teachers, total_school_resources,
                    last_updated
                ) VALUES (
                    :school_id, :school_name, :iern, :region, :division, :district,
                    :total_teachers, :total_classrooms, :total_seats,
                    :total_learners, :total_toilets, :total_furniture, :total_organized_classes, :total_teaching_experience, :total_specialized_teachers, :total_school_resources,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (school_id) DO UPDATE SET
                    school_name = EXCLUDED.school_name,
                    iern = EXCLUDED.iern,
                    region = EXCLUDED.region,
                    division = EXCLUDED.division,
                    total_teachers = EXCLUDED.total_teachers,
                    total_classrooms = EXCLUDED.total_classrooms,
                    total_seats = EXCLUDED.total_seats,
                    total_learners = EXCLUDED.total_learners,
                    total_toilets = EXCLUDED.total_toilets,
                    total_furniture = EXCLUDED.total_furniture,
                    total_organized_classes = EXCLUDED.total_organized_classes,
                    total_teaching_experience = EXCLUDED.total_teaching_experience,
                    total_specialized_teachers = EXCLUDED.total_specialized_teachers,
                    total_school_resources = EXCLUDED.total_school_resources,
                    last_updated = CURRENT_TIMESTAMP;
            """)
            
            conn.execute(stmt, data_to_insert)
            # Ensure column is removed if it exists
            conn.execute(text("ALTER TABLE school_summary DROP COLUMN IF EXISTS net_learners;"))
            conn.commit()
            
        print("School Summary Table Updated Successfully.")

    except Exception as e:
        print(f"Error updating school_summary: {e}")

def analyze_school_summary(engine):
    """
    Phase 2: Load school_summary and perform fraud detection analysis.
    This replaces the original fraud detection that used school_profiles.
    """
    print("\n=== Phase 2: Fraud Detection on School Summary ===")
    
    try:
        # Load school_summary
        print("Loading school_summary for analysis...")
        query = "SELECT * FROM school_summary"
        df = pd.read_sql(query, engine)
        print(f"Loaded {len(df)} schools from summary table.")
        
        # Calculate efficiency ratios using summary columns
        print("Calculating efficiency ratios...")
        
        # Helper for safe division
        def safe_divide(numerator, denominator, default=0):
            return np.where(denominator > 0, numerator / denominator, default)
        
        # Pupil-Teacher Ratio (PTR)
        df['ptr'] = safe_divide(df['total_learners'], df['total_teachers'], 0)
        
        # Pupil-Classroom Ratio (PCR)
        df['pcr'] = safe_divide(df['total_learners'], df['total_classrooms'], 0)
        
        # Pupil-Seat Ratio (PSR)
        df['psr'] = safe_divide(df['total_learners'], df['total_seats'], 0)
        
        # Pupil-Toilet Ratio (PtrR)
        df['ptorr'] = safe_divide(df['total_learners'], df['total_toilets'], 0)
        
        # Pupil-Furniture Ratio (PFR)
        df['pfr'] = safe_divide(df['total_learners'], df['total_furniture'], 0)
        
        # Run outlier detection (Z-scores)
        print("Detecting outliers (Z-scores)...")
        ratio_cols = ['ptr', 'pcr', 'psr', 'ptorr', 'pfr']
        
        for col in ratio_cols:
            # Calculate Z-scores for non-zero values
            valid_data = df[df[col] > 0][col]
            if len(valid_data) > 10:  # Need sufficient data
                z_scores = zscore(valid_data)
                z_threshold = 3.0
                
                # Create flag column
                flag_col = f'flag_outlier_{col}' if col != 'ptorr' and col != 'pfr' else f'flag_outlier_{col}'
                df[flag_col] = False
                df.loc[valid_data.index, flag_col] = np.abs(z_scores) > z_threshold
        
        # Flag zero values for critical metrics
        df['flag_zero_teachers'] = (df['total_teachers'] == 0) & (df['total_learners'] > 0)
        df['flag_zero_classrooms'] = (df['total_classrooms'] == 0) & (df['total_learners'] > 0)
        
        # === ENHANCED RULE 1: Additional Zero-Value Flags ===
        print("Checking for zero-value anomalies...")
        df['flag_zero_seats'] = (df['total_seats'] == 0) & (df['total_learners'] > 0)
        df['flag_zero_toilets'] = (df['total_toilets'] == 0) & (df['total_learners'] > 0)
        df['flag_zero_furniture'] = (df['total_furniture'] == 0) & (df['total_learners'] > 0)
        df['flag_zero_resources'] = (df['total_school_resources'] == 0) & (df['total_learners'] > 0)
        df['flag_zero_organized_classes'] = (df['total_organized_classes'] == 0) & (df['total_learners'] > 0)
        
        # === ENHANCED RULE 2: Correlation-Based Anomaly Detection ===
        print("Running correlation-based anomaly detection...")
        
        # Metrics to check against total_learners
        metrics_to_check = {
            'total_teachers': 'teachers',
            'total_classrooms': 'classrooms',
            'total_seats': 'seats',
            'total_toilets': 'toilets',
            'total_furniture': 'furniture',
            'total_organized_classes': 'organized_classes'
        }
        
        for metric_col, metric_name in metrics_to_check.items():
            # Only analyze schools with learners and non-zero metric values
            valid = (df['total_learners'] > 0) & (df[metric_col] > 0)
            
            if valid.sum() > 30:  # Need sufficient data for meaningful correlation
                X = df.loc[valid, 'total_learners'].values
                y = df.loc[valid, metric_col].values
                
                # Calculate expected value using simple linear regression (y = slope * X)
                slope = np.sum(X * y) / np.sum(X * X) if np.sum(X * X) > 0 else 0
                
                # Calculate residuals for ALL schools (not just valid)
                expected = df['total_learners'] * slope
                residual = df[metric_col] - expected
                
                # Calculate Z-scores of residuals for valid data
                valid_residuals = residual[valid]
                if len(valid_residuals) > 0 and valid_residuals.std() > 0:
                    z_scores = (valid_residuals - valid_residuals.mean()) / valid_residuals.std()
                    z_threshold = 3.0
                    
                    # Flag schools with large deviations
                    df[f'flag_anomaly_{metric_name}'] = False
                    df.loc[valid, f'flag_anomaly_{metric_name}'] = np.abs(z_scores) > z_threshold
                else:
                    df[f'flag_anomaly_{metric_name}'] = False
            else:
                df[f'flag_anomaly_{metric_name}'] = False
        
        # === ENHANCED RULE 3: Teacher Metrics Validation ===
        print("Validating teacher metrics consistency...")
        
        # Teaching experience should approximately equal total teachers
        # Allow some tolerance (±5) for rounding and data entry variations
        df['flag_exp_mismatch'] = (
            (df['total_teachers'] > 0) & 
            (np.abs(df['total_teaching_experience'] - df['total_teachers']) > 5)
        )
        
        # Specialized teachers mismatch (must match exactly)
        df['flag_spec_mismatch'] = (df['total_teachers'] > 0) & (np.abs(df['total_specialized_teachers'] - df['total_teachers']) > 0)
        
        # Zero specialization reported (when teachers exist)
        df['flag_zero_specialization'] = (df['total_specialized_teachers'] == 0) & (df['total_teachers'] > 0)
        
        # Calculate data health score with HEAVY penalty for zero-value flags
        print("Calculating data health scores...")
        
        # Separate zero-value flags from other flags
        zero_flags = [col for col in df.columns if col.startswith('flag_zero_')]
        other_flags = [col for col in df.columns if col.startswith('flag_') and not col.startswith('flag_zero_')]
        
        # Count each type
        df['zero_flag_count'] = df[zero_flags].sum(axis=1)
        df['other_flag_count'] = df[other_flags].sum(axis=1)
        
        # Heavy penalty for zero values (20 points each), lighter for anomalies (5 points each)
        # BASE CALCULATION
        df['calculated_score'] = np.maximum(100 - (df['zero_flag_count'] * 20) - (df['other_flag_count'] * 5), 0)
        
        # === OPTIMIZATION: STRICT CAPS ===
        # 1. No Learners = Score 0 (Critical)
        # 2. Missing Key Resources (Teachers/Classrooms) = Max Score 75 (Fair)
        
        def apply_caps(row):
            # Critical: No Enrollment
            if row['total_learners'] == 0:
                return 0
            
            # Fair Cap: Missing Teachers or Classrooms (even if learners exist)
            if row['flag_zero_teachers'] or row['flag_zero_classrooms']:
                return min(row['calculated_score'], 75)
                
            return row['calculated_score']

        df['data_health_score'] = df.apply(apply_caps, axis=1)
        
        # Generate issues summary
        def generate_issues(row):
            issues = []
            
            # Zero-value issues (highest priority)
            if row['flag_zero_teachers']:
                issues.append("No Teachers Reported")
            if row['flag_zero_classrooms']:
                issues.append("No Classrooms Reported")
            if row['flag_zero_seats']:
                issues.append("No Seats Reported")
            if row['flag_zero_toilets']:
                issues.append("No Toilets Reported")
            if row['flag_zero_furniture']:
                issues.append("No Furniture Reported")
            if row['flag_zero_resources']:
                issues.append("No Resources Reported")
            if row['flag_zero_organized_classes']:
                issues.append("No Organized Classes Reported")
            
            # Correlation anomalies
            if row['flag_anomaly_teachers']:
                issues.append("Teacher Count Inconsistent with Enrollment")
            if row['flag_anomaly_classrooms']:
                issues.append("Classroom Count Inconsistent with Enrollment")
            if row['flag_anomaly_seats']:
                issues.append("Seat Count Inconsistent with Enrollment")
            if row['flag_anomaly_toilets']:
                issues.append("Toilet Count Inconsistent with Enrollment")
            if row['flag_anomaly_furniture']:
                issues.append("Furniture Count Inconsistent with Enrollment")
            if row['flag_anomaly_organized_classes']:
                issues.append("Organized Class Count Inconsistent with Enrollment")
            
            # Teacher validation issues
            if row['flag_exp_mismatch']:
                issues.append("Teaching Experience Breakdown Mismatched with Total Teachers")
            if row['flag_spec_mismatch']:
                issues.append("Specialization Count Mismatched with Total Teachers")
            if row['flag_zero_specialization']:
                issues.append("No Specialization Data Reported")
            
            # Ratio outliers
            if row['flag_outlier_ptr']:
                issues.append("Extreme Pupil-Teacher Ratio")
            if row['flag_outlier_pcr']:
                issues.append("Extreme Pupil-Classroom Ratio")
            if row['flag_outlier_psr']:
                issues.append("Extreme Pupil-Seat Ratio")
            if row['flag_outlier_ptorr']:
                issues.append("Extreme Pupil-Toilet Ratio")
            if row['flag_outlier_pfr']:
                issues.append("Extreme Pupil-Furniture Ratio")
            
            return "; ".join(issues) if issues else "None"
        
        df['issues'] = df.apply(generate_issues, axis=1)
        
        # Description based on score (only 100 is Excellent)
        def get_health_description(score):
            if score == 100:
                return "Excellent"
            elif score >= 80:
                return "Good"
            elif score >= 50:
                return "Fair"
            else:
                return "Critical"
        
        df['data_health_description'] = df['data_health_score'].apply(get_health_description)
        
        # Update database with health scores and flags
        print("Updating school_summary with health scores...")
        
        # Get all flag columns
        flag_columns = [col for col in df.columns if col.startswith('flag_')]
        
        # Prepare update data
        update_cols = ['school_id', 'data_health_score', 'data_health_description', 'issues'] + flag_columns
        update_df = df[update_cols]
        
        with engine.connect() as conn:
            for _, row in update_df.iterrows():
                # Build dynamic UPDATE statement
                set_clauses = ['data_health_score = :score', 'data_health_description = :description', 'issues = :issues']
                params = {
                    'school_id': row['school_id'],
                    'score': float(row['data_health_score']),
                    'description': row['data_health_description'],
                    'issues': row['issues']
                }
                
                for flag_col in flag_columns:
                    set_clauses.append(f"{flag_col} = :{flag_col}")
                    params[flag_col] = bool(row[flag_col]) if pd.notnull(row[flag_col]) else False
                
                update_stmt = text(f"""
                    UPDATE school_summary 
                    SET {', '.join(set_clauses)}
                    WHERE school_id = :school_id
                """)
                
                conn.execute(update_stmt, params)
            
            conn.commit()
        
        print(f"Successfully updated health scores for {len(df)} schools.")
        print(f"Average health score: {df['data_health_score'].mean():.1f}")
        print(f"Schools with Critical health: {len(df[df['data_health_description'] == 'Critical'])}")
        
    except Exception as e:
        print(f"Error in analyze_school_summary: {e}")
        import traceback
        traceback.print_exc()

def main():
    # Parse Arguments
    target_school_id = None
    if len(sys.argv) > 1:
        target_school_id = sys.argv[1]
        print(f"Started Advanced Fraud Detection for Target School: {target_school_id}")
    else:
        print("Started Advanced Fraud Detection (Full Batch)")

    # === PHASE 1: Populate School Summary from School Profiles ===
    print("\n=== Phase 1: Populating School Summary ===")
    
    # 1. Connect and load school_profiles
    df, engine = connect_and_load_data()
    if df is None or df.empty:
        return

    # 2. Scan (Informational)
    scan_correlations(df)
    
    # 3. Clean & Impute
    df = clean_and_impute(df)
    
    # 4. Update Summary Table (with aggregates from school_profiles)
    update_school_summary_table(df, engine)
    
    # === PHASE 2: Fraud Detection on School Summary ===
    # Run analysis on the populated summary table
    analyze_school_summary(engine)
    
    print("\nAdvanced Fraud Detection & Health Check Complete.")

if __name__ == "__main__":
    main()
