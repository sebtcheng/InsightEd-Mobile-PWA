import pkg from 'pg';
const { Pool } = pkg;

const neonUrl = 'postgresql://neondb_owner:npg_z8JNLGaE0pFr@ep-dry-forest-a14epyio-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const localUrl = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

const disableMaintenance = async (dbUrl, dbName) => {
    const pool = new Pool({ connectionString: dbUrl });
    try {
        console.log(`Connecting to ${dbName}...`);

        // Upsert to ensure keys exist
        const query = `
            INSERT INTO system_settings (setting_key, setting_value, updated_at, updated_by)
            VALUES ('maintenance_mode', 'false', CURRENT_TIMESTAMP, 'script_override')
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = 'false', updated_at = CURRENT_TIMESTAMP, updated_by = 'script_override';
        `;

        await pool.query(query);
        console.log(`✅ Maintenance Mode DISABLED on ${dbName}.`);

    } catch (err) {
        console.error(`❌ Failed on ${dbName}:`, err.message);
    } finally {
        await pool.end();
    }
};

(async () => {
    console.log("--- DISABLING MAINTENANCE MODE ---");
    await disableMaintenance(neonUrl, 'Primary (Neon)');
    // Uncomment if you want to sync to secondary manually
    // await disableMaintenance(localUrl, 'Secondary (Local)');
    console.log("--- DONE ---");
})();
