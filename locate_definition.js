
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'api', 'index.js');
const content = fs.readFileSync(filePath, 'utf8');

// Regex for:
// 1. async function calculateSchoolProgress
// 2. function calculateSchoolProgress
// 3. const calculateSchoolProgress =
// 4. let calculateSchoolProgress =
const regex = /(?:async\s+)?function\s+calculateSchoolProgress\s*\(|(?:const|let|var)\s+calculateSchoolProgress\s*=\s*/;

const match = regex.exec(content);
if (match) {
    const lines = content.substring(0, match.index).split('\n');
    console.log("LINE_NUMBER:" + lines.length);
} else {
    console.log("Definition not found.");
}
