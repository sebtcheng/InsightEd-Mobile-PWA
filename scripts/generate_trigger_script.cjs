const fs = require('fs');
const path = require('path');

const fileContent = fs.readFileSync(path.resolve(__dirname, '../all_columns.json'), 'ucs2');

// Filter out dotenv logs
const cleanContent = fileContent.split('\n')
    .filter(line => !line.trim().startsWith('[dotenv'))
    .join('\n');

const start = cleanContent.indexOf('[');
const end = cleanContent.lastIndexOf(']');

if (start === -1 || end === -1) {
    throw new Error("Could not find JSON array in all_columns.json");
}

const jsonString = cleanContent.substring(start, end + 1);
const allColumns = JSON.parse(jsonString);

// Define Category Matchers (Exact same as before)
const categories = {
    'form_school_profile': [
        'school_id', 'school_name', 'region', 'division', 'province', 'city', 'municipality', 'barangay',
        'district', 'leg_district', 'coordinates', 'latitude', 'longitude', 'school_type', 'curricular_offering', 'iern',
        'mother_school_id', 'email', 'updated_at', 'submitted_at', 'submitted_by', 'history_logs',
        'data_health_score', 'data_health_description', 'mahalanobis_score', 'forms_to_recheck',
        'forms_completed_count', 'completion_percentage', 'f1_profile', 'f2_head', 'f3_enrollment',
        'f4_classes', 'f5_teachers', 'f6_specialization', 'f7_resources', 'f8_facilities', 'f9_shifting', 'f10_stats'
    ],
    'form_school_head': [
        'head_name', 'head_last_name', 'head_first_name', 'head_middle_name',
        'head_position', 'head_position_title', 'head_item_number', 'head_date_hired',
        'head_contact', 'head_email', 'school_head_validation'
    ],
    'form_enrollment': [
        'total_enrollment', 'es_enrollment', 'jhs_enrollment', 'shs_enrollment',
        'enrolled_', 'grade_', 'abm_', 'stem_', 'humss_', 'gas_', 'tvl_', 'arts_', 'sports_',
        'seats_'
    ],
    'form_organized_classes': ['classes_'],
    'form_learner_stats': ['stat_', 'learner_stats_grids'],
    'form_shifting_modalities': ['shift_', 'adm_', 'mode_'],
    'form_teaching_personnel': ['teach_', 'non_teaching_', 'teachers_'],
    'form_specialization': ['spec_'],
    'form_school_resources': ['res_'],
    'form_physical_facilities': ['build_', 'makeshift_']
};

const zombieColumns = ['res_faucets', 'res_internet_type', 'res_ownership_type'];

let remainingColumns = [...allColumns].filter(c => !zombieColumns.includes(c));
const categorized = {};

for (const [tableName, matchers] of Object.entries(categories)) {
    categorized[tableName] = [];
    matchers.forEach(matcher => {
        const matches = remainingColumns.filter(c => {
            if (c === matcher) return true;
            if (matcher.endsWith('_') && c.startsWith(matcher)) return true;
            return false;
        });

        matches.forEach(m => {
            if (!categorized[tableName].includes(m)) {
                categorized[tableName].push(m);
                remainingColumns = remainingColumns.filter(rc => rc !== m);
            }
        });
    });
}

if (remainingColumns.length > 0) {
    categorized['form_school_profile'].push(...remainingColumns);
}

// Generate the script content
let scriptBody = `
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createTriggers() {
    const client = await pool.connect();
    try {
        console.log("🚀 Creating Database Triggers...");

        const functionBody = \`
CREATE OR REPLACE FUNCTION sync_school_profiles_to_forms() RETURNS TRIGGER AS $$
BEGIN
\`;
`;

// Build the PL/PGSQL function body
let sqlParts = [];

for (const [tableName, cols] of Object.entries(categorized)) {
    // 1. Remove school_id AND iern from the specific list if present
    const columns = cols.filter(c => c !== 'school_id' && c !== 'iern');
    // 2. Always include 'school_id' and 'iern'
    const allCols = ['school_id', 'iern', ...columns];

    const colList = allCols.join(', ');
    const valList = allCols.map(c => `NEW.${c}`).join(', ');

    // ON CONFLICT UPDATE set list (exclude school_id)
    const updateList = allCols
        .filter(c => c !== 'school_id')
        .map(c => `${c} = EXCLUDED.${c}`)
        .join(', ');

    sqlParts.push(`
    -- Sync ${tableName}
    INSERT INTO ${tableName} (${colList})
    VALUES (${valList})
    ON CONFLICT (school_id) DO UPDATE SET
    ${updateList};
    `);
}

scriptBody += `
        const fullFunction = \`\${functionBody}
${sqlParts.join('\n')}
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;\`;

        console.log("1️⃣  Replacing Function: sync_school_profiles_to_forms...");
        await client.query(fullFunction);

        console.log("2️⃣  Creating Trigger...");
        await client.query('DROP TRIGGER IF EXISTS trigger_sync_to_forms ON school_profiles');
        await client.query(\`
            CREATE TRIGGER trigger_sync_to_forms
            AFTER INSERT OR UPDATE ON school_profiles
            FOR EACH ROW EXECUTE FUNCTION sync_school_profiles_to_forms();
        \`);

        console.log("✅ Triggers successfully installed!");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

createTriggers();
`;

fs.writeFileSync(path.resolve(__dirname, 'create_triggers_final.cjs'), scriptBody, 'utf8');
console.log("Derived script written to scripts/create_triggers_final.cjs");
