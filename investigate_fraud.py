
import pandas as pd
from sqlalchemy import create_engine, text
import sys

# Set output encoding to utf-8 to handle special chars
sys.stdout.reconfigure(encoding='utf-8')

DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def investigate():
    engine = create_engine(DB_CONNECTION_STRING)
    
    query = """
    SELECT 
        school_id, 
        total_learners, 
        total_teachers, 
        total_classrooms, 
        total_toilets, 
        total_furniture,
        total_teaching_experience,
        total_specialized_teachers,
        data_health_score, 
        data_health_description,
        issues
    FROM school_summary
    WHERE data_health_description = 'Excellent'
    AND (
        total_toilets = 0 OR 
        total_furniture = 0 OR 
        total_teaching_experience = 0 OR
        total_specialized_teachers = 0
    )
    """
    
    try:
        df = pd.read_sql(query, engine)
        
        print(f"Found {len(df)} schools with 'Excellent' health but 0 in some totals.")
        
        if not df.empty:
            print("\n--- Schools with Zero Toilets ---")
            zero_toilets = df[df['total_toilets'] == 0]
            print(f"Count: {len(zero_toilets)}")
            if not zero_toilets.empty:
                print(zero_toilets[['school_id', 'total_learners', 'total_toilets', 'data_health_score']].head().to_string())
                
            print("\n--- Schools with Zero Furniture ---")
            zero_furniture = df[df['total_furniture'] == 0]
            print(f"Count: {len(zero_furniture)}")
            if not zero_furniture.empty:
                print(zero_furniture[['school_id', 'total_learners', 'total_furniture', 'data_health_score']].head().to_string())
            
            print("\n--- Schools with Zero Teaching Experience ---")
            zero_exp = df[df['total_teaching_experience'] == 0]
            print(f"Count: {len(zero_exp)}")
            if not zero_exp.empty:
                print(zero_exp[['school_id', 'total_teachers', 'total_teaching_experience', 'data_health_score']].head().to_string())
                
            print("\n--- Schools with Zero Specialized Teachers ---")
            zero_spec = df[df['total_specialized_teachers'] == 0]
            print(f"Count: {len(zero_spec)}")
            if not zero_spec.empty:
                print(zero_spec[['school_id', 'total_teachers', 'total_specialized_teachers', 'data_health_score']].head().to_string())
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    investigate()
