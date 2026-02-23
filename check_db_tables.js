const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:password@localhost:5432/postgres' });

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    .then(res => {
        console.log("Tables:");
        res.rows.forEach(r => console.log(r.table_name));
        return pool.query("SELECT COUNT(*) FROM schools");
    })
    .then(res => {
        console.log("Schools count:", res.rows[0].count);
        process.exit(0);
    })
    .catch(err => {
        console.error(err.message);
        process.exit(1);
    });
