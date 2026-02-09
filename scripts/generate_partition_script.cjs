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

// Define Category Matchers (Exact same as before + Refinements)
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
    'form_learner_stats': ['stat_', 'learner_stats_grids'], // included learner_stats_grids
    'form_shifting_modalities': ['shift_', 'adm_', 'mode_'],
    'form_teaching_personnel': ['teach_', 'non_teaching_', 'teachers_'],
    'form_specialization': ['spec_'],
    'form_school_resources': ['res_'],
    'form_physical_facilities': ['build_', 'makeshift_']
};

const zombieColumns = ['res_faucets', 'res_internet_type', 'res_ownership_type'];

let remainingColumns = [...allColumns].filter(c => !zombieColumns.includes(c));
const categorized = {};

// Helper to remove school_id if it exists to avoid duplication (we add it manually)
function cleanCols(cols) {
    return cols.filter(c => c !== 'school_id');
}

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

// Leftovers go to form_school_profile
if (remainingColumns.length > 0) {
    console.log("Leftover columns assigned to form_school_profile:", remainingColumns);
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

async function createPartitions() {
    const client = await pool.connect();
    try {
        console.log("🚀 Starting Partition Creation...");
`;

for (const [tableName, cols] of Object.entries(categorized)) {
    // Ensure school_id is NOT in the columns list we select, because we might want to cast it or handle it specifically? 
    // Actually, simple Select includes it if it matches. 
    // But 'school_id' was assigned to 'form_school_profile'. 
    // We want 'school_id' in ALL tables.

    // So:
    // 1. Remove school_id from the specific list if present (it is in form_school_profile).
    // 2. Always prepend 'school_id' to the select list.

    const columns = cols.filter(c => c !== 'school_id'); // Remove unique school_id if present in this bucket
    const selectColumns = ['school_id', ...columns].join(',\n    ');

    scriptBody += `
        // --- ${tableName} ---
        console.log("Creating ${tableName}...");
        await client.query('DROP TABLE IF EXISTS ${tableName}');
        await client.query(\`
            CREATE TABLE ${tableName} AS
            SELECT 
    ${selectColumns}
            FROM school_profiles;
        \`);
        await client.query('ALTER TABLE ${tableName} ADD PRIMARY KEY (school_id)');
    `;
}

scriptBody += `
        console.log("✅ All Partitions Created & Populated!");
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

createPartitions();
`;

fs.writeFileSync(path.resolve(__dirname, 'create_partitions_final.cjs'), scriptBody, 'utf8');
console.log("Derived script written to scripts/create_partitions_final.cjs");
