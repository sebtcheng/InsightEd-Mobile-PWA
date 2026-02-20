import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:\\Users\\KleinZebastianCatapa\\Documents\\INSIGHTEDCODES2026\\public\\Masterlist 2026-2030 139706 CL - with Cong-Gov-Mayor.xlsx';

console.log("Starting script v3...");

if (fs.existsSync(filePath)) {
    try {
        console.log("Reading file...");
        // Read only the necessary parts if possible, but readFile reads all. 
        // We will optimize the parsing part.
        const workbook = XLSX.readFile(filePath);
        console.log("File read successfully.");

        const sheetName = workbook.SheetNames[0];
        console.log("Sheet Name:", sheetName);

        const sheet = workbook.Sheets[sheetName];

        if (sheet['!ref']) {
            const range = XLSX.utils.decode_range(sheet['!ref']);
            // Limit to first 5 rows (0-indexed)
            range.e.r = Math.min(range.e.r, 5);
            const newRef = XLSX.utils.encode_range(range);
            console.log("Reading range:", newRef);

            const data = XLSX.utils.sheet_to_json(sheet, { range: newRef, header: 1 });

            if (data.length > 0) {
                console.log("Headers:", JSON.stringify(data[0]));
                if (data.length > 1) {
                    console.log("Sample Data (Row 1):", JSON.stringify(data[1]));
                }
            } else {
                console.log("No data found.");
            }
        } else {
            console.log("Sheet is empty or has no ref.");
        }

    } catch (error) {
        console.error("Error reading file:", error);
    }
} else {
    console.log("File does not exist.");
}
console.log("Done.");
