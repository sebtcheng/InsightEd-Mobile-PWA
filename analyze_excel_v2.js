import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:\\Users\\KleinZebastianCatapa\\Documents\\INSIGHTEDCODES2026\\public\\Masterlist 2026-2030 139706 CL - with Cong-Gov-Mayor.xlsx';

console.log("Starting script...");

if (fs.existsSync(filePath)) {
    console.log("File exists.");
    try {
        console.log("Reading file...");
        const workbook = XLSX.readFile(filePath);
        console.log("File read successfully.");

        const sheetName = workbook.SheetNames[0];
        console.log("Sheet Name:", sheetName);

        const sheet = workbook.Sheets[sheetName];
        console.log("Converted to JSON...");

        // Get headers (first row)
        const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
        console.log("Headers:", JSON.stringify(headers));

        // Get first few rows of data to infer types
        const data = XLSX.utils.sheet_to_json(sheet).slice(0, 3);
        console.log("Sample Data:", JSON.stringify(data));

    } catch (error) {
        console.error("Error reading file:", error);
    }
} else {
    console.log("File does not exist.");
}
console.log("Done.");
