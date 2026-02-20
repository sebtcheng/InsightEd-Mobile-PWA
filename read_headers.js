import fs from 'fs';

try {
    const content = fs.readFileSync('output.txt', 'utf16le');
    const lines = content.split('\r\n'); // Windows EOL
    let found = false;
    for (const line of lines) {
        if (line.includes('Headers:')) {
            console.log("FOUND HEADERS:");
            // Print in chunks to avoid truncation
            for (let i = 0; i < line.length; i += 500) {
                console.log(line.substring(i, i + 500));
            }
            found = true;
        }
        if (line.includes('Sample Data')) {
            console.log("FOUND SAMPLE:");
            for (let i = 0; i < line.length; i += 500) {
                console.log(line.substring(i, i + 500));
            }
        }
    }
    if (!found) { // Try \n split just in case
        const lines2 = content.split('\n');
        for (const line of lines2) {
            if (line.includes('Headers:')) {
                console.log("FOUND HEADERS (newline split):");
                for (let i = 0; i < line.length; i += 500) {
                    console.log(line.substring(i, i + 500));
                }
            }
        }
    }
} catch (e) {
    console.error(e);
}
