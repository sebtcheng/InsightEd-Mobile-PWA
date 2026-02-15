
import pandas as pd
from sqlalchemy import create_engine

DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def verify_issues():
    try:
        engine = create_engine(DB_CONNECTION_STRING)
        query = "SELECT school_id, issues FROM school_summary WHERE issues != 'None' LIMIT 5"
        df = pd.read_sql(query, engine)
        
        print(f"Loaded {len(df)} schools with issues.")
        for index, row in df.iterrows():
            print(f"School ID: {row['school_id']}")
            print(f"Issues: {row['issues']}")
            print("-" * 50)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_issues()
