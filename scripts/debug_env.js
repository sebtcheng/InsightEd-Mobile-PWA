import fs from 'fs';

try {
    const raw = fs.readFileSync('.env');
    console.log("Raw buffer length:", raw.length);

    // Check BOM
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
        console.log("Detected UTF-16LE BOM");
        const content = raw.toString('utf16le');
        console.log("Content length (chars):", content.length);
        const lines = content.split(/\r?\n/);
        lines.forEach(line => {
            if (line.includes('NEW_DATABASE_URL')) {
                console.log("FOUND LINE:", line);
            }
        });
    } else {
        console.log("No UTF-16LE BOM. Trying UTF-8");
        const content = raw.toString('utf8');
        const lines = content.split(/\r?\n/);
        lines.forEach(line => {
            if (line.includes('NEW_DATABASE_URL')) {
                console.log("FOUND LINE:", line);
            }
        });
    }

} catch (e) {
    console.error(e);
}
