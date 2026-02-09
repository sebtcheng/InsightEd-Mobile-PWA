import fs from 'fs';

const filePath = 'api/index.js';
const snippetPath = 'lgu_endpoints_snippet.js';

try {
    const buffer = fs.readFileSync(filePath);
    const nullByteIndex = buffer.indexOf(0x00);

    if (nullByteIndex !== -1) {
        console.log(`Found null byte at index ${nullByteIndex}. Diagnosed UTF-16LE corruption.`);

        // Find the last newline before the corruption to be safe
        let cutOff = nullByteIndex;
        while (cutOff > 0 && buffer[cutOff] !== 10) { // 10 is newline \n
            cutOff--;
        }

        console.log(`Truncating at index ${cutOff} (end of valid UTF-8 content).`);

        const cleanBuffer = buffer.slice(0, cutOff);
        fs.writeFileSync(filePath, cleanBuffer);

        console.log('File truncated. Appending snippet properly...');

        const snippet = fs.readFileSync(snippetPath, 'utf8');
        fs.appendFileSync(filePath, '\n' + snippet, 'utf8');

        console.log('✅ api/index.js repaired and snippet appended.');
    } else {
        console.log('No corruption detected (no null bytes). Checking if snippet is present...');
        const content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes('api/lgu/save-project')) {
            console.log('Snippet missing. Appending...');
            const snippet = fs.readFileSync(snippetPath, 'utf8');
            fs.appendFileSync(filePath, '\n' + snippet, 'utf8');
            console.log('Snippet appended.');
        } else {
            console.log('Snippet already present and file seems valid.');
        }
    }
} catch (err) {
    console.error('Error:', err);
}
