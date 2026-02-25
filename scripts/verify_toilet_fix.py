
from sqlalchemy import create_engine, text
import pandas as pd

DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def verify_issues():
    engine = create_engine(DB_CONNECTION_STRING)
    query = "SELECT school_id, data_health_score, issues FROM school_summary WHERE school_id = '111493'"
    df = pd.read_sql(query, engine)
    print(df)
    if "No toilets are reported" in df['issues'].iloc[0]:
        print("FAIL: Toilet issue still present")
    else:
        print("SUCCESS: Toilet issue cleared")

if __name__ == "__main__":
    verify_issues()
