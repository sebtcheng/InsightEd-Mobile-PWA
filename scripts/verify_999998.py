import pandas as pd
from sqlalchemy import create_engine
DB_CONNECTION_STRING = 'postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd'
engine = create_engine(DB_CONNECTION_STRING)
query = "SELECT school_id, total_learners, total_classrooms, flag_outlier_pcr, flag_anomaly_classrooms FROM school_summary WHERE school_id = '999998'"
print(pd.read_sql(query, engine))
