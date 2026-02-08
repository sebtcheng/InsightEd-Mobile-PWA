
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
    df['num_teachers'] = np.maximum(summary_teacher_sum, granular_teacher_sum)
    
    # Classrooms
    # distinct from 'build_classrooms_total' which might be pre-calculated
    # Let's trust 'build_classrooms_total' if it exists and is non-zero, else sum types
    if 'build_classrooms_total' in df.columns:
         df['num_classrooms'] = pd.to_numeric(df['build_classrooms_total'], errors='coerce').fillna(0)
    else:
         classroom_cols = ['build_classrooms_good', 'build_classrooms_repair', 'build_classrooms_new']
         df['num_classrooms'] = df.apply(lambda x: sum_cols(x, classroom_cols), axis=1)

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

def main():
    # Parse Arguments
    target_school_id = None
    if len(sys.argv) > 1:
        target_school_id = sys.argv[1]
        print(f"Started Advanced Fraud Detection for Target School: {target_school_id}")
    else:
        print("Started Advanced Fraud Detection (Full Batch)")

    # 1. Connect
    df, engine = connect_and_load_data()
    if df is None or df.empty:
        return

    # 2. Scan (Informational)
    scan_correlations(df)
    
    # 3. Clean & Impute
    df = clean_and_impute(df)
    
    # 4. Feature Engineering
    df = feature_engineering(df)
    
    # 5. Univariate
    df = detect_univariate_outliers(df)
    
    # 6. Multivariate
    df = detect_multivariate_outliers(df)
    
    # 7. Auditing & Scoring
    df = audit_data_health_completeness(df)
    df = calculate_final_scores(df) # Generate forms_to_recheck here
    
    # 8. Export (Skipped)
    
    # 9. Update DB (Targeted)
    update_database(df, engine, target_school_id)
    
    print("\nAdvanced Fraud Detection & Health Check Complete.")

if __name__ == "__main__":
    main()
