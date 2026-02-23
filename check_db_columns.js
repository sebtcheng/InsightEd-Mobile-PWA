const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:Password321@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'schools'")
    .then(res => {
        console.log("Columns in schools table:");
        res.rows.forEach(r => console.log(r.column_name));
        process.exit(0);
    })
    .catch(err => {
        console.error(err.message);
        process.exit(1);
    });
