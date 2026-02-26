import pandas as pd
from sqlalchemy import create_engine
from scipy.stats import zscore

DB_CONNECTION_STRING = "postgresql+psycopg2://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"
engine = create_engine(DB_CONNECTION_STRING)

query = "SELECT * FROM school_summary"
df = pd.read_sql(query, engine)

print(f"Total schools: {len(df)}")
me = df[df['school_id'] == '999998']
print(f"School 999998:")
print(me[['school_id', 'total_learners', 'total_classrooms', 'data_health_score', 'flag_outlier_pcr', 'flag_anomaly_classrooms']])

# Force to float
df['total_learners'] = pd.to_numeric(df['total_learners'], errors='coerce').fillna(0)
df['total_classrooms'] = pd.to_numeric(df['total_classrooms'], errors='coerce').fillna(0)

df['pcr'] = df['total_learners'] / df['total_classrooms'].replace(0, pd.NA)
df['pcr'] = pd.to_numeric(df['pcr'].fillna(0), errors='coerce')

print(f"Mean PCR: {df[df['pcr'] > 0]['pcr'].mean():.2f}")
print(f"Std PCR: {df[df['pcr'] > 0]['pcr'].std():.2f}")

valid_pcr = df[df['pcr'] > 0]['pcr'].astype(float)
if len(valid_pcr) > 0:
    z_scores = zscore(valid_pcr)
    me_pcr = float(me['total_learners'].iloc[0] / me['total_classrooms'].iloc[0] if len(me) > 0 and me['total_classrooms'].iloc[0] > 0 else 0)
    print(f"School 999998 PCR: {me_pcr:.2f}")

    if len(me) > 0:
        z = (me_pcr - valid_pcr.mean()) / valid_pcr.std(ddof=0)
        print(f"School 999998 PCR Z-Score: {z:.2f}")

# Correlation anomaly
metric_col = 'total_classrooms'
valid = (df['total_learners'] > 0) & (df[metric_col] > 0)
if len(df[valid]) > 30:
    X = df.loc[valid, 'total_learners'].astype(float).values
    y = df.loc[valid, metric_col].astype(float).values
    slope = sum(X * y) / sum(X * X) if sum(X * X) > 0 else 0
    print(f"Slope (learners vs classrooms): {slope:.6f}")

    residual = df[metric_col].astype(float) - (df['total_learners'].astype(float) * slope)
    valid_residuals = residual[valid]
    residuals_mean = valid_residuals.mean()
    residuals_std = valid_residuals.std()

    print(f"Residual Mean: {residuals_mean:.2f}")
    print(f"Residual Std: {residuals_std:.2f}")
    if len(me) > 0:
        me_resid = float(me['total_classrooms'].iloc[0] - (me['total_learners'].iloc[0] * slope))
        me_z = (me_resid - residuals_mean) / residuals_std
        print(f"School 999998 Residual: {me_resid:.2f}, Z-Score: {me_z:.2f}")

        print("Expected classrooms for 999998:", slope * me['total_learners'].iloc[0])
else:
    print("Not enough valid rows for correlation.")
