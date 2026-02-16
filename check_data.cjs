const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkData() {
    try {
        await client.connect();

        const categories = ['sned', 'disability', 'als', 'muslim', 'ip', 'displaced', 'repetition', 'overage', 'dropout'];
        const grades = ['k', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12'];

        console.log("Checking for non-zero values in a sample of columns...");

        for (const cat of categories) {
            let hasData = false;
            for (const grade of grades) {
                const col = `stat_${cat}_${grade}`;
                const query = `SELECT COUNT(*) as count FROM school_profiles WHERE ${col} > 0`;
                const res = await client.query(query);
                const count = parseInt(res.rows[0].count);
                if (count > 0) {
                    console.log(`✅ Data found for ${col}: ${count} rows have value > 0`);
                    hasData = true;
                    break; // Found at least one grade with data for this category
                }
            }
            if (!hasData) {
                console.log(`❌ NO data found for category ${cat} across any grade.`);
                // Check if maybe the column name is different?
            }
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkData();
