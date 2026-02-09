const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'deped_monitoring_db',
    password: '123', // From previous context I recall '123' or '1234' or 'admin'. Let's check api/index.js if needed.
    // api/index.js uses process.env.DATABASE_URL usually.
    // I see in task.md or context: "postgres://postgres:1234@localhost:5432/deped_monitoring_db"?
    // I'll try that string.
    connectionString: "postgres://postgres:1234@localhost:5432/deped_monitoring_db"
});

const verifySchema = async () => {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'lgu_forms'
        `);

        const existing = res.rows.map(r => r.column_name);
        const expected = [
            'moa_date', 'tranches_count', 'tranche_amount', 'fund_source',
            'province', 'city', 'municipality', 'legislative_district',
            'scope_of_works', 'contract_amount', 'bid_opening_date',
            'resolution_award_date', 'procurement_stage', 'bidding_date',
            'awarding_date', 'construction_start_date', 'funds_downloaded',
            'funds_utilized'
        ];

        console.log("EXISTING COLUMNS:", existing);

        const missing = expected.filter(e => !existing.includes(e));

        if (missing.length === 0) {
            console.log("\n✅ ALL EXPECTED LGU COLUMNS PRESENT!");
        } else {
            console.error("\n❌ MISSING COLUMNS:", missing);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
};

verifySchema();
