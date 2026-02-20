
const fetch = require('node-fetch');
const fs = require('fs');

async function run() {
    try {
        const res = await fetch('http://localhost:3000/api/debug-integrity');
        const data = await res.json();

        let output = "--------------------------------------------------\n";
        output += `Total Rows: ${data.count}\n`;
        output += `Shortage Sum: ${data.shortage_sum}\n`;
        output += `Duplicate Count (Sample): ${data.duplicates.length}\n`;

        if (data.duplicates.length > 0) {
            output += "--- DUPLICATE SAMPLES ---\n";
            data.duplicates.forEach(d => {
                output += `School: ${d.school_id}, Year: ${d.proposed_funding_year}, Sty: ${d.sty}, CL: ${d.cl}, Count: ${d.count}\n`;
            });
        }
        output += "--------------------------------------------------\n";

        fs.writeFileSync('debug_output.txt', output);

    } catch (e) {
        fs.writeFileSync('debug_output.txt', `Error: ${e.message}`);
    }
}
run();
