
from sqlalchemy import create_engine, text
import pandas as pd

DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def check_data():
    engine = create_engine(DB_CONNECTION_STRING)
    # Check for schools that have issues but might have bowl data
    query = """
    SELECT school_id, 
           res_toilets_female, res_toilets_male, res_toilets_common, res_toilets_pwd,
           total_female_bowls_func, total_male_bowls_func, total_pwd_bowls_func,
           female_bowls_func, male_bowls_func, pwd_bowls_func
    FROM school_profiles 
    WHERE (res_toilets_female + res_toilets_male + res_toilets_common + res_toilets_pwd) = 0
    AND (total_female_bowls_func + total_male_bowls_func + total_pwd_bowls_func + female_bowls_func + male_bowls_func + pwd_bowls_func) > 0
    LIMIT 5
    """
    df = pd.read_sql(query, engine)
    print(df)

if __name__ == "__main__":
    check_data()
