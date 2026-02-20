import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import XLSX from 'xlsx';
import path from 'path';

// Load environment variables
dotenv.config();

// Robust .env parsing
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
    try {
        let envContent = fs.readFileSync('.env', 'utf16le');
        let match = envContent.match(/DATABASE_URL=(.+)/);
        if (!match) {
            envContent = fs.readFileSync('.env', 'utf8');
            match = envContent.match(/DATABASE_URL=(.+)/);
        }
        if (match) {
            dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
        }
    } catch (e) {
        console.error("Failed to parse .env:", e);
    }
}

if (!dbUrl) {
    console.error("DATABASE_URL not found!");
    process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 20
});

const filePath = 'C:\\Users\\KleinZebastianCatapa\\Documents\\INSIGHTEDCODES2026\\public\\Masterlist 2026-2030 139706 CL - with Cong-Gov-Mayor.xlsx';

async function importData() {
    console.log("Reading Excel file...");
    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const totalRows = range.e.r + 1;
    console.log(`Expected total rows: ${totalRows}`);

    const client = await pool.connect();
    try {
        console.log("Truncating table...");
        await client.query('TRUNCATE TABLE psip RESTART IDENTITY');
        client.release();

        const BATCH_SIZE = 2000;
        const CONCURRENCY = 10;
        let inserted = 0;

        let headerRow = [
            "Index", "CONGRESSMAN", "GOVERNOR", "MAYOR", "Region", "Division",
            "School ID", "LIS/NSBI School ID 24-25", "In Masterlist with Gov", "School Name",
            "Municipality", "Leg District", "PRIORITY INDEX", "CL Requirement",
            "Estimated Classroom Shortage", "No. of Sites", "Proposed No. of Classrooms",
            "No. of Unit", "STY", "CL", "Proposed Scope Of Work", "Number of Workshops",
            "Workshop Type/s", "Other Design Configurations (If any)", "PROPOSED FUNDING YEAR",
            "Est. Cost of Classrooms", "Project Implementor", "CL/STY"
        ];

        // Create batches first (just ranges)
        const batches = [];
        for (let r = 1; r < totalRows; r += BATCH_SIZE) {
            batches.push(r);
        }

        console.log(`Total batches to process: ${batches.length}`);

        // Process batches with concurrency
        const processBatch = async (r) => {
            const endRow = Math.min(r + BATCH_SIZE - 1, range.e.r);
            const subRange = { s: { c: 0, r: r }, e: { c: range.e.c, r: endRow } };
            const opts = { range: subRange, header: headerRow };

            const batch = XLSX.utils.sheet_to_json(sheet, opts);
            if (batch.length === 0) return 0;

            const client = await pool.connect();
            try {
                const values = [];
                const placeholders = [];

                batch.forEach((row, index) => {
                    const offset = index * 27;
                    const p = Array.from({ length: 27 }, (_, k) => `$${offset + k + 1}`);
                    placeholders.push(`(${p.join(',')})`);

                    values.push(
                        row['CONGRESSMAN'] || null,
                        row['GOVERNOR'] || null,
                        row['MAYOR'] || null,
                        row['Region'] || null,
                        row['Division'] || null,
                        parseInt(row['School ID']) || null,
                        parseInt(row['LIS/NSBI School ID 24-25']) || null,
                        parseInt(row['In Masterlist with Gov']) || 0,
                        row['School Name'] || null,
                        row['Municipality'] || null,
                        row['Leg District'] || null,
                        parseFloat(row['PRIORITY INDEX']) || null,
                        parseInt(row['CL Requirement']) || 0,
                        parseInt(row['Estimated Classroom Shortage']) || 0,
                        parseInt(row['No. of Sites']) || 0,
                        parseInt(row['Proposed No. of Classrooms']) || 0,
                        parseInt(row['No. of Unit']) || 0,
                        parseInt(row['STY']) || 0,
                        parseInt(row['CL']) || 0,
                        row['Proposed Scope Of Work'] || null,
                        parseInt(row['Number of Workshops']) || 0,
                        row['Workshop Type/s'] || null,
                        row['Other Design Configurations (If any)'] || null,
                        parseInt(row['PROPOSED FUNDING YEAR']) || null,
                        parseFloat(row['Est. Cost of Classrooms']) || 0,
                        row['Project Implementor'] || null,
                        parseInt(row['CL/STY']) || 0
                    );
                });

                const query = `
                    INSERT INTO psip (
                        congressman, governor, mayor, region, division, school_id, 
                        lis_school_id, in_masterlist_with_gov, school_name, municipality, 
                        leg_district, priority_index, cl_requirement, est_classroom_shortage, 
                        no_of_sites, proposed_no_of_classrooms, no_of_unit, sty, cl, 
                        proposed_scope_of_work, number_of_workshops, workshop_types, 
                        other_design_configs, proposed_funding_year, est_cost_of_classrooms, 
                        project_implementor, cl_sty
                    ) VALUES ${placeholders.join(',')}
                `;

                await client.query(query, values);
                process.stdout.write('.'); // Progress dot
                return batch.length;
            } catch (e) {
                console.error(`\nError in batch starting row ${r}:`, e.message);
                return 0;
            } finally {
                client.release();
            }
        };

        // Simple concurrency loop
        const results = [];
        const executing = [];

        for (const startRow of batches) {
            const p = processBatch(startRow).then(count => {
                inserted += count;
                // Remove from executing
                executing.splice(executing.indexOf(p), 1);
            });
            results.push(p);
            executing.push(p);

            if (executing.length >= CONCURRENCY) {
                await Promise.race(executing);
            }
        }

        await Promise.all(results);
        console.log(`\n✅ Successfully imported ${inserted} rows.`);

    } catch (err) {
        console.error("❌ Error importing data:", err);
    } finally {
        await pool.end();
    }
}

importData();
