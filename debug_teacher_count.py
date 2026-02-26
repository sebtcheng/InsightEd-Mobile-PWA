
import pandas as pd
from sqlalchemy import create_engine, text
import numpy as np

DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def debug_school(school_id):
    print(f"Debugging School ID: {school_id}")
    engine = create_engine(DB_CONNECTION_STRING)
    
    query = f"SELECT * FROM school_profiles WHERE school_id = '{school_id}'"
    df = pd.read_sql(query, engine)
    
    if df.empty:
        print("School not found.")
        return

    row = df.iloc[0]
    
    # 1. Summary Columns
    summary_t_cols = ['teachers_es', 'teachers_jhs', 'teachers_shs']
    print("\n--- Summary Columns ---")
    sum_summary = 0
    for c in summary_t_cols:
        val = row.get(c, 0)
        print(f"{c}: {val}")
        if pd.notnull(val): sum_summary += float(val)
    print(f"Total Summary: {sum_summary}")

    # 2. Granular Columns
    granular_t_cols = [
        'teach_kinder', 'teach_g1', 'teach_g2', 'teach_g3', 'teach_g4', 'teach_g5', 'teach_g6',
        'teach_g7', 'teach_g8', 'teach_g9', 'teach_g10', 'teach_g11', 'teach_g12',
        'teach_multi_1_2', 'teach_multi_3_4', 'teach_multi_5_6', 'teach_multi_3plus_count',
        'sned_teachers', 'non_advisory'
    ]
    print("\n--- Granular Columns ---")
    sum_granular = 0
    for c in granular_t_cols:
        val = row.get(c, 0)
        print(f"{c}: {val}")
        if pd.notnull(val): sum_granular += float(val)
    print(f"Total Granular: {sum_granular}")

    # 3. Specialization Columns
    spec_cols_temp = [
        'spec_english_teaching', 'spec_filipino_teaching', 'spec_math_teaching',
        'spec_science_teaching', 'spec_ap_teaching', 'spec_mapeh_teaching',
        'spec_esp_teaching', 'spec_tle_teaching', 'spec_guidance', 'spec_librarian',
        'spec_ict_coord', 'spec_drrm_coord', 'spec_general_teaching', 'spec_ece_teaching',
        'spec_bio_sci_teaching', 'spec_phys_sci_teaching', 'spec_agri_fishery_teaching',
        'spec_others_teaching'
    ]
    print("\n--- Specialization Columns ---")
    sum_spec = 0
    for c in spec_cols_temp:
        val = row.get(c, 0)
        print(f"{c}: {val}")
        if pd.notnull(val): sum_spec += float(val)
    print(f"Total Specialization: {sum_spec}")

    # Check calculated max
    print(f"\nMAX Calculated: {max(sum_summary, sum_granular, sum_spec)}")

if __name__ == "__main__":
    debug_school('300570')
