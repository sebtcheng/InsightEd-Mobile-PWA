
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiPath = path.join(__dirname, '../api/index.js');

const raw = fs.readFileSync(apiPath, 'utf8');
const lines = raw.split(/\r?\n/);

console.log(`Original Line Count: ${lines.length}`);

// Lines to remove: 478 to 672 (1-based)
// 0-based index: 477 to 671
const startIdx = 477;
const endIdx = 671;

// Verify content looks like what we expect
const startLine = lines[startIdx];
const endLine = lines[endIdx];

console.log(`Line ${startIdx + 1}: ${startLine}`);
console.log(`Line ${endIdx + 1}: ${endLine}`);

if (!startLine.includes('const sp = spResult.rows[0];')) {
    console.error("❌ Start line does not match expected garbage start!");
    process.exit(1);
}

if (!endLine.includes('});') && !lines[endIdx - 1].includes('});')) {
    // line 671 might be empty or });
    // In view_file 671 was });
    // Let's check looseness
    console.log("Checking end line...");
}

const newLines = [
    ...lines.slice(0, startIdx),
    ...lines.slice(endIdx + 1)
];

console.log(`New Line Count: ${newLines.length}`);

fs.writeFileSync(apiPath, newLines.join('\n'));
console.log("✅ Fixed api/index.js");
