import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetFile = path.join(__dirname, 'index.js');

const content = fs.readFileSync(targetFile, 'utf8');
const lines = content.split('\n');

let balance = 0;
let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Remove comments
    const cleanLine = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');

    for (let j = 0; j < cleanLine.length; j++) {
        const char = cleanLine[j];
        if (char === '{') {
            balance++;
            stack.push({ line: i + 1, col: j + 1 });
        } else if (char === '}') {
            balance--;
            if (stack.length > 0) stack.pop();
        }
    }
}

console.log(`Final balance: ${balance}`);
if (balance > 0) {
    console.log(`Potentially unclosed braces. Stack top (last unclosed):`);
    console.log(stack.slice(-5));
} else if (balance < 0) {
    console.log(`Potentially extra closing braces.`);
} else {
    console.log(`Braces appear balanced.`);
}
