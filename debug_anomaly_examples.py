
import pandas as pd
from sqlalchemy import create_engine, text
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

# Database Connection
DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def show_anomaly_examples():
    print("=== Fetching Anomaly Examples ===\n")
    try:
        engine = create_engine(DB_CONNECTION_STRING)
        
        with engine.connect() as conn:
            # Query for schools with "Teacher count anomaly" in issues
            print("--- Schools with 'Teacher Count Inconsistent' ---")
            query_teachers = text("""
                SELECT school_id, school_name, total_learners, total_teachers, issues
                FROM school_summary 
                WHERE issues LIKE '%Teacher Count Inconsistent%'
                LIMIT 5
            """)
            df_teachers = pd.read_sql(query_teachers, conn)
            if not df_teachers.empty:
                print(df_teachers.to_string(index=False))
            else:
                print("No schools found with 'Teacher Count Inconsistent'.")

            print("\n--- Schools with 'Experience Breakdown Mismatch' ---")
            query_exp = text("""
                SELECT school_id, school_name, total_teachers, total_teaching_experience, issues
                FROM school_summary 
                WHERE issues LIKE '%Teaching Experience Breakdown Mismatched%'
                LIMIT 5
            """)
            df_exp = pd.read_sql(query_exp, conn)
            if not df_exp.empty:
                print(df_exp.to_string(index=False))
            else:
                print("No schools found with 'Teaching Experience Breakdown Mismatched'.")

            print("\n--- Schools with 'Specialization Count Mismatched' ---")
            query_spec = text("""
                SELECT school_id, school_name, total_teachers, total_specialized_teachers, issues
                FROM school_summary 
                WHERE issues LIKE '%Specialization Count Mismatched%'
                LIMIT 5
            """)
            df_spec = pd.read_sql(query_spec, conn)
            if not df_spec.empty:
                print(df_spec.to_string(index=False))
            else:
                print("No schools found with 'Specialization Count Mismatched'.")

            print("\n--- Schools with 'No Specialization Data Reported' ---")
            query_zero_spec = text("""
                SELECT school_id, school_name, total_teachers, total_specialized_teachers, issues
                FROM school_summary 
                WHERE issues LIKE '%No Specialization Data Reported%'
                LIMIT 5
            """)
            df_zero_spec = pd.read_sql(query_zero_spec, conn)
            if not df_zero_spec.empty:
                print(df_zero_spec.to_string(index=False))
            else:
                print("No schools found with 'No Specialization Data Reported'.")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    show_anomaly_examples()
