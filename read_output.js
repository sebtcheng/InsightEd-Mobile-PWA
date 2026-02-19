import fs from 'fs';

try {
    // Read as utf-16le which is default for powershell >
    const content = fs.readFileSync('output.txt', 'utf16le');
    console.log(content);
} catch (e) {
    console.error(e);
}
