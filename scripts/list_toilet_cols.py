
from sqlalchemy import create_engine, text
import pandas as pd

DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def list_columns():
    engine = create_engine(DB_CONNECTION_STRING)
    query = "SELECT column_name FROM information_schema.columns WHERE table_name = 'school_profiles' ORDER BY ordinal_position"
    with engine.connect() as conn:
        result = conn.execute(text(query))
        cols = [row[0] for row in result]
        search_terms = ['toilet', 'seat', 'bowl', 'water', 'facility', 'comfort', 'cr']
        for col in cols:
            if any(term in col.lower() for term in search_terms):
                print(col)

if __name__ == "__main__":
    list_columns()
