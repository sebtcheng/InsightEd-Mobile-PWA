const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:****@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd' });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%school%';").then(res => {
    console.log(res.rows);
    pool.end();
}).catch(console.error);
