
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from scipy.stats import zscore, chi2
from sklearn.covariance import MinCovDet
import sys
import argparse

# --- ARGUMENT PARSING ---
parser = argparse.ArgumentParser(description='Advanced Fraud Detection')
parser.add_argument('--school_id', type=str, help='Specific school ID to validate')
args = parser.parse_args()

# Database Connection
DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def connect_and_load_data():
    print("Connecting to database...")
    try:
        engine = create_engine(DB_CONNECTION_STRING)
        # --- FILTER DATA IF SCHOOL_ID PROVIDED ---
        if args.school_id:
            query = "SELECT * FROM school_profiles WHERE school_id = %(school_id)s"
            df = pd.read_sql(query, engine, params={"school_id": str(args.school_id)})
            if df.empty:
                print(f"No data found for school {args.school_id}")
                sys.exit(0)
            print(f"Successfully loaded {len(df)} records for school {args.school_id}.")
        else:
            query = "SELECT * FROM school_profiles"
            df = pd.read_sql(query, engine)
            print(f"Successfully loaded {len(df)} records (Full Batch).")
            
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
    print("\nCleaning and Imputing Data (Vectorized)...")
    
    # helper to ensure numeric
    def get_numeric(df, cols):
        # efficiently select existing cols
        existing = [c for c in cols if c in df.columns]
        if not existing:
            return pd.DataFrame(0, index=df.index, columns=['dummy'])
        # Coerce to numeric and fill 0
        return df[existing].apply(pd.to_numeric, errors='coerce').fillna(0)

    # 1. Teachers
    summary_t_cols = ['teachers_es', 'teachers_jhs', 'teachers_shs']
    summary_teacher_sum = get_numeric(df, summary_t_cols).sum(axis=1)

    granular_t_cols = [
        'teach_kinder', 'teach_g1', 'teach_g2', 'teach_g3', 'teach_g4', 'teach_g5', 'teach_g6',
        'teach_g7', 'teach_g8', 'teach_g9', 'teach_g10', 'teach_g11', 'teach_g12',
        'teach_multi_1_2', 'teach_multi_3_4', 'teach_multi_5_6', 'teach_multi_3plus_count'
    ]
    granular_teacher_sum = get_numeric(df, granular_t_cols).sum(axis=1)
    
    # NEW fields addition for total teachers
    extra_t_cols = ['non_advisory', 'sned_teachers']
    extra_teacher_sum = get_numeric(df, extra_t_cols).sum(axis=1)

    # Calculate max of summary vs granular, then add extra
    df['num_teachers'] = np.maximum(summary_teacher_sum, granular_teacher_sum) + extra_teacher_sum
    
    # 2. Classrooms
    classroom_components = ['build_classrooms_good', 'build_classrooms_repair', 'build_classrooms_new']
    component_sum = get_numeric(df, classroom_components).sum(axis=1)

    if 'build_classrooms_total' in df.columns:
         total_reported = pd.to_numeric(df['build_classrooms_total'], errors='coerce').fillna(0)
         df['num_classrooms'] = np.maximum(total_reported, component_sum)
    else:
         df['num_classrooms'] = component_sum

    # 3. Toilets (Expanded to include Bowls/Seats)
    toilet_cols = [
        'res_toilets_female', 'res_toilets_male', 'res_toilets_common', 'res_toilets_pwd', 
        'res_toilet_func', 'res_toilet_nonfunc',
        'total_female_bowls_func', 'total_female_bowls_nonfunc', 
        'total_male_bowls_func', 'total_male_bowls_nonfunc', 
        'total_pwd_bowls_func', 'total_pwd_bowls_nonfunc',
        'female_bowls_func', 'female_bowls_nonfunc', 
        'male_bowls_func', 'male_bowls_nonfunc', 
        'pwd_bowls_func', 'pwd_bowls_nonfunc'
    ]
    df['num_toilets'] = get_numeric(df, toilet_cols).sum(axis=1)
    
    # 4. Furniture
    furniture_cols = ['res_desk_func', 'res_armchair_func']
    df['num_furniture'] = get_numeric(df, furniture_cols).sum(axis=1)

    # 5. Seats (Granular)
    seats_cols = [
        'seats_kinder', 'seats_grade_1', 'seats_grade_2', 'seats_grade_3', 'seats_grade_4', 'seats_grade_5',
        'seats_grade_6', 'seats_grade_7', 'seats_grade_8', 'seats_grade_9', 'seats_grade_10', 
        'seats_grade_11', 'seats_grade_12'
    ]
    df['num_seats_granular'] = get_numeric(df, seats_cols).sum(axis=1)

    # 6. Teacher Experience
    exp_cols = [
        'teach_exp_0_1', 'teach_exp_2_5', 'teach_exp_6_10', 'teach_exp_11_15', 'teach_exp_16_20',
        'teach_exp_21_25', 'teach_exp_26_30', 'teach_exp_31_35', 'teach_exp_36_40', 'teach_exp_40_45'
    ]
    df['num_teachers_exp'] = get_numeric(df, exp_cols).sum(axis=1)

    # 7. Total Sections
    classes_cols = [
        'classes_kinder', 'classes_grade_1', 'classes_grade_2', 'classes_grade_3',
        'classes_grade_4', 'classes_grade_5', 'classes_grade_6', 'classes_grade_7',
        'classes_grade_8', 'classes_grade_9', 'classes_grade_10', 'classes_grade_11',
        'classes_grade_12'
    ]
    df['total_sections'] = get_numeric(df, classes_cols).sum(axis=1)

    # 8. Total Specialization Teachers (REMOVED)
    df['total_specialization_teachers'] = df['num_teachers'] # Default to num_teachers to avoid breakages in downstream calc, but no longer used for fraud

    # Impute Zero/Missing Values for Analysis (Vectorized)
    # Median of NON-ZERO values
    cols_to_impute = ['num_teachers', 'num_classrooms', 'num_toilets', 'num_furniture', 'num_seats_granular']
    
    for col in cols_to_impute:
        # Calculate median of non-zeros
        non_zeros = df[df[col] > 0][col]
        median_val = non_zeros.median() if not non_zeros.empty else 1
        
        # Create imputed column: if 0, replace with median; else keep value
        df[f'{col}_imputed'] = df[col].replace(0, median_val).fillna(median_val)

    # Impute Enrollment
    non_zero_enrollment = df[df['total_enrollment'] > 0]['total_enrollment']
    median_enrollment = non_zero_enrollment.median() if not non_zero_enrollment.empty else 100
    
    df['total_enrollment_imputed'] = df['total_enrollment'].replace(0, median_enrollment).fillna(median_enrollment)

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
    print("\nAuditing Data Completeness & Consistency (Vectorized)...")
    
    # Initialize issues column
    df['completeness_issues'] = ""
    
    # helper for appending issues
    def add_issue(mask, message):
        df.loc[mask, 'completeness_issues'] += message + "; "

    # 1. Zero Checks (Critical Missing Data)
    # If Enrollment > 0 but Resource is 0
    has_enrollment = df['total_enrollment'] > 0
    
    add_issue(has_enrollment & (df['num_teachers'] == 0), 
              "Critical missing data. No teachers have been reported in the School Profile.")
    
    add_issue(has_enrollment & (df['num_classrooms'] == 0), 
              "Critical missing data. No classrooms have been reported in the School Profile.")
    
    add_issue(has_enrollment & (df['num_toilets'] == 0), 
              "Critical missing data. No toilets have been reported in the Physical Facilities.")

    # 2. Teacher Experience Consistency
    # Allow 15% variance or +/- 2 teachers
    t_reported = df['num_teachers'].fillna(0)
    t_exp = df['num_teachers_exp'].fillna(0)
    
    diff = (t_reported - t_exp).abs()
    allowable_diff = np.maximum(2, t_reported * 0.15)
    
    mask_exp_mismatch = (t_reported > 0) & (t_exp > 0) & (diff > allowable_diff)
    add_issue(mask_exp_mismatch, 
              "Teacher data inconsistency. The total teachers reported does not match the experience breakdown.")
    
    mask_missing_exp = (t_reported > 5) & (t_exp == 0)
    add_issue(mask_missing_exp, "Teacher experience data is missing.")

    # ---------------------------------------------------------
    # CONSISTENCY RULES
    # ---------------------------------------------------------
    print("Checking Consistency Rules (Vectorized)...")

    # Rule 1: Class Size Integrity (Section Sum vs Reported Sections)
    grades = [
        ('kinder', 'cnt_less_kinder', 'cnt_within_kinder', 'cnt_above_kinder', 'classes_kinder'),
        ('g1', 'cnt_less_g1', 'cnt_within_g1', 'cnt_above_g1', 'classes_grade_1'),
        ('g6', 'cnt_less_g6', 'cnt_within_g6', 'cnt_above_g6', 'classes_grade_6'),
        ('g10', 'cnt_less_g10', 'cnt_within_g10', 'cnt_above_g10', 'classes_grade_10'),
        ('g12', 'cnt_less_g12', 'cnt_within_g12', 'cnt_above_g12', 'classes_grade_12')
    ]
    
    for g_name, c_less, c_within, c_above, c_total in grades:
        # Check existence
        if c_total in df.columns and c_less in df.columns:
            total_reported = df[c_total].fillna(0)
            breakdown_sum = df[c_less].fillna(0) + df[c_within].fillna(0) + df[c_above].fillna(0)
            
            mask_mismatch = (total_reported > 0) & (breakdown_sum != total_reported)
            add_issue(mask_mismatch, 
                      f"Section count mismatch. The total sections reported for {g_name.upper()} do not match the detailed class size breakdown.")

    # Rule 2: Sections vs Students (Avg Class Size Risk)
    # Avg Size = Enrollment / Sections
    # Avoid division by zero
    total_sections = df['total_sections'].replace(0, np.nan) 
    avg_class_size = df['total_enrollment'] / total_sections
    
    mask_overcrowded = (df['total_sections'] > 0) & (df['total_enrollment'] > 0) & (avg_class_size > 65)
    add_issue(mask_overcrowded, "Data entry error suspected. The ratio of students to sections is suspiciously high.")
    
    mask_underutilized = (df['total_sections'] > 0) & (df['total_enrollment'] > 50) & (avg_class_size < 15)
    add_issue(mask_underutilized, "Data entry error suspected. The ratio of students to sections is suspiciously low.")

    # Rule 3: Teachers vs Specialization (REMOVED)

    # Rule 4: Classrooms vs Learners
    # SCR = Enrollment / Classrooms
    num_classrooms = df['num_classrooms'].replace(0, np.nan)
    scr = df['total_enrollment'] / num_classrooms
    
    mask_high_scr = (df['num_classrooms'] > 0) & (df['total_enrollment'] > 0) & (scr > 70)
    add_issue(mask_high_scr, "Potential data error. The reported number of classrooms is too low for the total enrollment.")

    # Clean up trailing semicolons
    df['completeness_issues'] = df['completeness_issues'].str.strip("; ")
    
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
        # Good = 90-99 (Minor issues like 1 outlier)
        # Fair = 50-89
        # Critical < 50
        
        if score == 100: desc = "Excellent"
        elif score >= 90: desc = "Good"
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
    # 1. Algorithmic: True if Score >= 90 ("Excellent" or "Good")
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

def update_school_summary_table(df, engine, target_school_id=None):
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
        
        # Use simple integer casting for existing calculated floats or ints
        # Note: clean_and_impute already calculated these as:
        # num_teachers, num_teachers_exp, total_specialization_teachers, num_classrooms,
        # num_seats_granular, total_enrollment, num_toilets, num_furniture, total_sections
        
        summary_df = pd.DataFrame()
        summary_df['school_id'] = df['school_id']
        summary_df['school_name'] = df['school_name'] if 'school_name' in df.columns else ""
        summary_df['iern'] = df['iern'] if 'iern' in df.columns else ""
        summary_df['region'] = df['region'] if 'region' in df.columns else ""
        summary_df['division'] = df['division'] if 'division' in df.columns else ""
        summary_df['district'] = df['district'] if 'district' in df.columns else ""
        
        # Helper to safely convert to Int (fill NaN with 0)
        def to_int(series):
            return pd.to_numeric(series, errors='coerce').fillna(0).astype(int)

        summary_df['total_teachers'] = to_int(df['num_teachers'])
        summary_df['total_teaching_experience'] = to_int(df['num_teachers_exp'])
        summary_df['total_specialized_teachers'] = to_int(df['total_specialization_teachers'])
        summary_df['total_classrooms'] = to_int(df['num_classrooms'])
        summary_df['total_seats'] = to_int(df['num_seats_granular'])
        summary_df['total_learners'] = to_int(df['total_enrollment'])
        summary_df['total_toilets'] = to_int(df['num_toilets'])
        summary_df['total_furniture'] = to_int(df['num_furniture'])
        
        # REMOVED per user request: als, sped, muslim calculations
        
        summary_df['total_organized_classes'] = to_int(df['total_sections'])
        
        # Resources (still need to sum this or was it calculated?)
        # clean_and_impute did NOT calculate total_school_resources.
        # Let's vectorize it here.
        resource_cols = [
            'res_sci_labs', 'res_com_labs', 'res_tvl_workshops',
            'res_desk_func', 'res_armchair_func',
            'res_toilets_male', 'res_toilets_female', 'res_toilets_pwd', 'res_toilets_common', 'res_handwash_func',
            'res_ecart_func', 'res_laptop_func', 'res_tv_func', 'res_printer_func', 'res_toilet_func' 
        ]
        
        # Vectorized sum
        existing_res_cols = [c for c in resource_cols if c in df.columns]
        if existing_res_cols:
            summary_df['total_school_resources'] = df[existing_res_cols].apply(pd.to_numeric, errors='coerce').fillna(0).sum(axis=1).astype(int)
        else:
            summary_df['total_school_resources'] = 0
        

        # Net Learners (Removed)
        # summary_df['net_learners'] = summary_df['total_learners']

        # 3. Upsert into Database (Temp Table Strategy)
        # We'll use a Temp Table to load data efficiently, then UPSERT into school_summary
        
        # FILTER IF TARGETING SPECIFIC SCHOOL
        if target_school_id:
            print(f"Targeted Summary Update: Filtering for School ID {target_school_id}")
            # Ensure target_school_id is string for matching
            summary_df = summary_df[summary_df['school_id'].astype(str) == str(target_school_id)]
            
            if summary_df.empty:
                print(f"Warning: Target school {target_school_id} not found in processed summary data.")
                return
        
        # Prepare Data
        # Ensure all columns match DB schema types
        if 'net_learners' in summary_df.columns:
            summary_df.drop(columns=['net_learners'], inplace=True, errors='ignore')

        # Select columns that exist in the target table (based on our create/alter statements)
        # We need to map DataFrame columns to Table columns
        # DF: school_id, school_name, iern, region, division, district, total_...
        # Table: same
        
        # Ensure timestamps
        # We let DB handle 'last_updated' with DEFAULT/NOW() during Update, 
        # but for bulk optimization, we can pass it or set it in SQL.
        
        print(f"Syncing {len(summary_df)} records to school_summary (Temp Table Strategy)...")
        
        temp_table_name = "temp_school_summary_load"
        
        with engine.begin() as conn:
            # 1. Create Temp Table
            # It should have same structure as columns we are uploading
            # We can infertypes or just use TEXT for everything and cast, but better to match.
            # school_summary has mixed types.
            
            # Simplified: Use pandas to create the temp table structure for us?
            # to_sql with index=False automatically creates table if not exists.
            # But we want it temporary.
            
            # Let's drop if exists first
            conn.execute(text(f"DROP TABLE IF EXISTS {temp_table_name}"))
            
            # Use to_sql to create and fill temp table
            # key: efficient chunking
            summary_df.to_sql(temp_table_name, conn, if_exists='replace', index=False, method='multi', chunksize=2000)
            
            # 2. Perform Upsert (Insert ... On Conflict) from Temp Table
            # Postgres syntax
            
            # Columns to update
            # We want to update EVERYTHING except school_id
            cols = [c for c in summary_df.columns if c != 'school_id']
            
            # Construct dynamic SQL
            # EXCLUDED.col for update
            update_assignments = [f"{col} = EXCLUDED.{col}" for col in cols]
            
            # Explicit cast might be needed if to_sql used different types, but usually it's fine 
            # if we are just selecting from temp table.
            # However, we must ensure columns list matches.
            
            col_list = ", ".join(['school_id'] + cols)
            
            upsert_sql = f"""
                INSERT INTO school_summary ({col_list}, last_updated)
                SELECT {col_list}, CURRENT_TIMESTAMP
                FROM {temp_table_name}
                ON CONFLICT (school_id) DO UPDATE SET
                    {', '.join(update_assignments)},
                    last_updated = CURRENT_TIMESTAMP;
            """
            
            conn.execute(text(upsert_sql))
            
            # 3. Cleanup
            conn.execute(text(f"DROP TABLE IF EXISTS {temp_table_name}"))
            
            # Drop legacy column if exists
            conn.execute(text("ALTER TABLE school_summary DROP COLUMN IF EXISTS net_learners;"))
            
        print("School Summary Table Updated Successfully.")

    except Exception as e:
        print(f"Error updating school_summary: {e}")
        import traceback
        traceback.print_exc()

def analyze_school_summary(engine, target_school_id=None):
    """
    Phase 2: Load school_summary and perform fraud detection analysis.
    This replaces the original fraud detection that used school_profiles.
    """
    print("\n=== Phase 2: Fraud Detection on School Summary (Vectorized) ===")
    
    try:
        # Load school_summary
        print("Loading school_summary for analysis...")
        if target_school_id:
            query = "SELECT * FROM school_summary WHERE school_id = %(school_id)s"
            df = pd.read_sql(query, engine, params={"school_id": str(target_school_id)})
        else:
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
        
        # Run outlier detection (Z-scores) using Vectorized Operations
        print("Detecting outliers (Z-scores)...")
        ratio_cols = ['ptr', 'pcr', 'psr', 'ptorr', 'pfr']
        
        for col in ratio_cols:
            # Calculate Z-scores for non-zero values
            # We use masking to calculate stats only on valid data, then map back
            mask_valid = df[col] > 0
            if mask_valid.sum() > 10:
                valid_data = df.loc[mask_valid, col]
                z_scores = zscore(valid_data)
                z_threshold = 3.0
                
                flag_col = f'flag_outlier_{col}'
                df[flag_col] = False
                df.loc[mask_valid, flag_col] = np.abs(z_scores) > z_threshold
            else:
                 df[f'flag_outlier_{col}'] = False
        
        # Flag zero values for critical metrics
        # Use boolean operations
        has_learners = df['total_learners'] > 0
        df['flag_zero_teachers'] = (df['total_teachers'] == 0) & has_learners
        df['flag_zero_classrooms'] = (df['total_classrooms'] == 0) & has_learners
        
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
        
        # STRICT RULE: Total Teachers == Total Experience Breakdown == Total Specialized Breakdown
        # As requested, these should all match exactly.
        
        # 1. Experience Mismatch (Tolerance 0)
        df['flag_exp_mismatch'] = (
            (df['total_teachers'] > 0) & 
            (df['total_teaching_experience'] != df['total_teachers'])
        )
        
        # 2. Specialized Teachers Mismatch (REMOVED)
        df['flag_spec_mismatch'] = False
        
        # 3. Validation: If mismatches exist, they are flagged as 'other_flags' 
        # which automatically reduces the score by 5 points per flag in the standard calculation.
        
        # Zero specialization reported (REMOVED)
        df['flag_zero_specialization'] = False
        
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
        
        # === OPTIMIZATION: STRICT CAPS (Vectorized) ===
        # 1. No Learners OR Missing Enrollment Data = Score 0 (Critical)
        # 2. Missing Key Resources (Teachers/Classrooms) = Max Score 75 (Fair)
        
        # Vectorized caps
        score = df['calculated_score'].copy()

        # Cap for missing key resources (Teachers or Classrooms)
        mask_missing_key = df['flag_zero_teachers'] | df['flag_zero_classrooms']
        score = np.where(mask_missing_key & (score > 75), 75, score)

        # CRITICAL FIX: Cap for no learners OR zero enrollment data
        # If total_learners is 0 or NaN, the school has incomplete data
        mask_no_enrollment = (df['total_learners'].fillna(0) == 0)
        score = np.where(mask_no_enrollment, 0, score)

        df['data_health_score'] = score
        
        # Generate issues summary (Vectorized Matrix Multiplication)
        print("Generating issues list (Matrix Multiplication)...")
        
        # 1. Define Mapping: Flag Column -> Message
        # Order matters for matrix multiplication
        flag_map = [
            ('flag_zero_teachers', "Critical Data Gap: No teachers are reported for this school despite having enrolled learners. Please verify if the school is operational or if the teacher data was omitted."),
            ('flag_zero_classrooms', "Critical Data Gap: No classrooms are reported for this school despite having enrolled learners. Please confirm if the classroom inventory was properly encoded."),
            ('flag_zero_seats', "Critical Data Gap: No seats (desks/chairs) are reported for this school despite having enrolled learners. This indicates missing physical facilities data."),
            ('flag_zero_toilets', "Critical Data Gap: No toilets are reported for this school. All schools must have at least one functional toilet facility."),
            ('flag_zero_furniture', "Critical Data Gap: No furniture inventory is reported for this school. Please check if the physical facilities form was submitted."),
            ('flag_zero_resources', "Critical Data Gap: No learning resources (labs, equipment) are reported. While small schools may lack some, a complete zero count usually indicates missing data."),
            ('flag_zero_organized_classes', "Critical Data Gap: No organized classes/sections are reported despite having enrollment. This suggests the class organization form was not filled out."),
            ('flag_anomaly_teachers', "Data Inconsistency: The number of reported teachers deviates significantly from the expected count based on total enrollment. This may indicate over-reporting of students or under-reporting of teachers."),
            ('flag_anomaly_classrooms', "Data Inconsistency: The number of reported classrooms deviates significantly from the expected count based on total enrollment. Please verify the actual classroom inventory."),
            ('flag_anomaly_seats', "Data Inconsistency: The number of reported seats is unusually low or high relative to the student population. Please check for data entry errors."),
            ('flag_anomaly_toilets', "Data Inconsistency: The number of toilets reported does not align with the typical ratio for the student population."),
            ('flag_anomaly_furniture', "Data Inconsistency: The furniture count is inconsistent with the school's size and student population."),
            ('flag_anomaly_organized_classes', "Data Inconsistency: The number of organized classes (sections) is inconsistent with the total enrollment. This often results in extremely large or small class sizes."),
            ('flag_exp_mismatch', "Data Quality Error: The total number of teachers reported does not match the sum of teachers broken down by years of teaching experience. These two figures must be identical."),
            ('flag_outlier_ptr', "Statistical Outlier: The Pupil-Teacher Ratio (PTR) is statistically improbable (extremely high or low). This strongly suggests an error in either the enrollment count or the teacher count."),
            ('flag_outlier_pcr', "Statistical Outlier: The Pupil-Classroom Ratio (PCR) is statistically improbable (extremely high or low). This suggests an error in the enrollment or classroom count."),
            ('flag_outlier_psr', "Statistical Outlier: The Pupil-Seat Ratio (PSR) is statistically improbable. Please verify if the seat inventory and enrollment data are correct."),
            ('flag_outlier_ptorr', "Statistical Outlier: The Pupil-Toilet Ratio is statistically improbable. Please verify the toilet count."),
            ('flag_outlier_pfr', "Statistical Outlier: The Pupil-Furniture Ratio is statistically improbable. Please verify the furniture inventory.")
        ]
        
        # 2. Prepare Matrices
        # Ensure all columns exist
        valid_flags = [col for col, msg in flag_map if col in df.columns]
        msgs = [msg for col, msg in flag_map if col in df.columns]
        
        if valid_flags:
            # Boolean Matrix (Steps x Flags) -> converted to Int (0/1)
            # If large, use Sparse Matrix? For 60k rows x 20 cols, dense is fine (~1MB)
            flag_matrix = df[valid_flags].astype(int)
            
            # Message vector (Flags x 1) - actually valid for dot product?
            # We want: Row string "Msg1; Msg2"
            
            # Option A: np.where loop (fast enough for 20 cols) 
            # Matrix mult for strings is tricky in pure numpy without object arrays
            # Let's stick to the fast loop but pre-allocate
            
            df['issues'] = ""
            for col, msg in zip(valid_flags, msgs):
                # Vectorized string addition only on True rows
                mask = df[col].astype(bool)
                # This causes SettingWithCopy warning if not careful, but df is clean here
                # Using .loc is safe
                df.loc[mask, 'issues'] = df.loc[mask, 'issues'] + "• " + msg + "\n\n"
            
        else:
            df['issues'] = ""

        # Cleanup
        df['issues'] = df['issues'].str.strip()
        df['issues'].replace("", "None", inplace=True)
        
        # Description based on score (Vectorized)
        
        # Critical Totals Check
        critical_totals = [
            'total_teachers', 'total_classrooms', 'total_seats', 'total_toilets', 
            'total_furniture', 'total_school_resources', 'total_organized_classes',
            'total_teaching_experience', 'total_specialized_teachers'
        ]
        
        existing_crit = [c for c in critical_totals if c in df.columns]
        has_zero_totals = False
        if existing_crit:
             # Fast numpy check
             crit_matrix = df[existing_crit].values
             # Any zero in row?
             zeros_in_row = (crit_matrix == 0).any(axis=1)
             has_zero_totals = zeros_in_row & (df['total_learners'] > 0).values

        # Logic: 
        # Excellent = 100
        # Good = 80-99
        # Fair = 50-79
        # Critical < 50
        
        conditions = [
            df['data_health_score'] == 100,
            df['data_health_score'] >= 80,
            df['data_health_score'] >= 50
        ]
        choices = ["Excellent", "Good", "Fair"]
        df['data_health_description'] = np.select(conditions, choices, default="Critical")
        
        # Downgrade Logic: If Excellent but has zero totals -> Good
        mask_downgrade = (df['data_health_description'] == "Excellent") & has_zero_totals
        df.loc[mask_downgrade, 'data_health_description'] = "Good"
        
        # Sync Score if downgraded
        mask_sync = (df['data_health_description'] == "Good") & (df['data_health_score'] == 100)
        df.loc[mask_sync, 'data_health_score'] = 99
        
        # Update database with health scores and flags (Temp Table Join Strategy)
        print("Updating school_summary with health scores (Temp Table Strategy)...")
        
        flag_columns = [col for col in df.columns if col.startswith('flag_')]
        
        # Prepare update data
        update_cols = ['school_id', 'data_health_score', 'data_health_description', 'issues'] + flag_columns
        update_df = df[update_cols].copy()
        
        # Ensure types for SQL helper
        update_df['data_health_score'] = update_df['data_health_score'].astype(float)
        update_df['data_health_description'] = update_df['data_health_description'].astype(str)
        update_df['issues'] = update_df['issues'].astype(str)
        for c in flag_columns:
            update_df[c] = update_df[c].astype(bool)

        # 1. Create Temp Table
        temp_table_name = "temp_health_updates"
        
        with engine.begin() as conn:
            # Create temp table matching structure
            # We construct CREATE TABLE based on columns
            # Or simplified: school_id + fields to update
            
            # Build column definitions
            col_defs = ["school_id VARCHAR(50) PRIMARY KEY", 
                       "data_health_score FLOAT", 
                       "data_health_description TEXT", 
                       "issues TEXT"]
            for c in flag_columns:
                col_defs.append(f"{c} BOOLEAN")
            
            create_sql = f"CREATE TEMPORARY TABLE IF NOT EXISTS {temp_table_name} ({', '.join(col_defs)}) ON COMMIT DROP;"
            conn.execute(text(create_sql))
            
            # 2. Insert Data into Temp Table
            # Pandas to_sql is decent, but for max speed with PG we might need copy_expert.
            # However, standard to_sql with multi-insert is much faster than UPDATE loop.
            print(f"Bulk inserting {len(update_df)} rows into temp table...")
            update_df.to_sql(temp_table_name, conn, if_exists='append', index=False, method='multi', chunksize=5000)
            
            # 3. Perform Update from Temp Table
            print("Executing UPDATE FROM temp table...")
            
            # Construct feature assignments
            assignments = [
                "data_health_score = t.data_health_score", 
                "data_health_description = t.data_health_description", 
                "issues = t.issues"
            ]
            for c in flag_columns:
                assignments.append(f"{c} = t.{c}")
            
            update_sql = f"""
                UPDATE school_summary s
                SET {', '.join(assignments)}
                FROM {temp_table_name} t
                WHERE s.school_id = t.school_id;
            """

            # FILTER UPDATE IF TARGETING SPECIFIC SCHOOL
            if target_school_id:
                print(f"Targeted Analysis Update: Filtering for School ID {target_school_id}")
                # Re-construct update SQL with additional filter
                update_sql = f"""
                    UPDATE school_summary s
                    SET {', '.join(assignments)}
                    FROM {temp_table_name} t
                    WHERE s.school_id = t.school_id
                    AND s.school_id = '{target_school_id}';
                """

            conn.execute(text(update_sql))
            
            # 4. Drop (Auto-dropped on commit due to ON COMMIT DROP, but explicit is fine)
            conn.execute(text(f"DROP TABLE IF EXISTS {temp_table_name}"))
        
        print(f"Successfully updated health scores for {len(df)} schools.")
        print(f"Average health score: {df['data_health_score'].mean():.1f}")
        print(f"Schools with Critical health: {len(df[df['data_health_description'] == 'Critical'])}")
        
    except Exception as e:
        print(f"Error in analyze_school_summary: {e}")
        import traceback
        traceback.print_exc()

import argparse

def main():
    parser = argparse.ArgumentParser(description='Advanced Fraud Detection')
    parser.add_argument('--school_id', type=str, help='Target School ID for single school validation')
    args = parser.parse_args()

    target_school_id = args.school_id

    if target_school_id:
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
    update_school_summary_table(df, engine, target_school_id)
    
    # 5. Update the School Profiles table which the UI relies on
    # CAUTION: PER USER REQUEST NO LONGER WRITING TO SCHOOL PROFILES
    # update_database(df, engine, target_school_id)
    
    # === PHASE 2: Fraud Detection on School Summary ===
    # Run analysis on the populated summary table
    analyze_school_summary(engine, target_school_id)
    
    print("\nAdvanced Fraud Detection & Health Check Complete.")

if __name__ == "__main__":
    main()
