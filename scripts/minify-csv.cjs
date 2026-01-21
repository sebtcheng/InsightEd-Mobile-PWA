const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Transform } = require('stream');

const inputFile = path.join(__dirname, '../public/Oct2025-GMIS-Filled_RAW.csv');
const outputFile = path.join(__dirname, '../public/Oct2025-GMIS-Filled_Minified.csv');

const KEEP_COLUMNS = [
    'PSI_CD',
    'LAST_NAME',
    'FIRST_NAME',
    'MID_NAME',
    'POS_DSC',
    'SEX',
    'UACS_REG_DSC',
    'UACS_DIV_DSC'
];

console.log(`Reading from: ${inputFile}`);
console.log(`Writing to: ${outputFile}`);
console.log(`Keeping columns: ${KEEP_COLUMNS.join(', ')}`);

const readStream = fs.createReadStream(inputFile);
const writeStream = fs.createWriteStream(outputFile);

// Write Header
writeStream.write(KEEP_COLUMNS.join(',') + '\n');

// Transform Stream to filter columns
const transformer = new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
        const row = [];
        KEEP_COLUMNS.forEach(col => {
            // Handle commas in data by wrapping in quotes if needed
            let val = chunk[col] || '';
            if (val.includes(',') || val.includes('"')) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            row.push(val);
        });
        this.push(row.join(',') + '\n');
        callback();
    }
});

let rowCount = 0;

readStream
    .pipe(csv())
    .pipe(transformer)
    .pipe(writeStream)
    .on('finish', () => {
        console.log('✅ Minification complete!');
        const stats = fs.statSync(outputFile);
        console.log(`New file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    })
    .on('error', (err) => {
        console.error('❌ Error:', err);
    });

// Log progress
transformer.on('data', () => {
    rowCount++;
    if (rowCount % 10000 === 0) {
        process.stdout.write(`Processed ${rowCount} rows...\r`);
    }
});
