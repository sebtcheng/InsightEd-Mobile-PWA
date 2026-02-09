const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const SRC_DIR = path.resolve(__dirname, '../src');
const API_DIR = path.resolve(__dirname, '../api');

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });

    return arrayOfFiles;
}

async function findUnusedColumns() {
    try {
        console.log("Fetching columns for 'school_profiles'...");
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'school_profiles'
        `);
        const columns = res.rows.map(r => r.column_name);
        console.log(`Found ${columns.length} columns.`);

        console.log("Scanning source files...");
        const srcFiles = getAllFiles(SRC_DIR, []);
        const apiFiles = getAllFiles(API_DIR, []);

        const files = [...srcFiles, ...apiFiles].filter(f =>
            !f.includes('db_init.js') &&
            !f.includes('scripts') &&
            !f.endsWith('.sql')
        );
        console.log(`Found ${files.length} functional files (excluded db_init.js).`);

        const columnUsage = {};
        columns.forEach(col => columnUsage[col] = 0);

        // Optimization: Read all files into memory once if they fit (text files only)
        // Or process file by file. Given the size, file by file is fine.

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            for (const col of columns) {
                if (content.includes(col)) {
                    columnUsage[col]++;
                }
            }
        }

        const unused = columns.filter(col => columnUsage[col] === 0);
        console.log("\n--- UNUSED COLUMNS CANDIDATES ---");
        unused.forEach(col => console.log(col));

        console.log("\n--- SUMMARY ---");
        console.log(`Total Columns: ${columns.length}`);
        console.log(`Unused Columns: ${unused.length}`);
        console.log(`Used Columns: ${columns.length - unused.length}`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

findUnusedColumns();
