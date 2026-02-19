import XLSX from 'xlsx';

const filePath = 'C:\\Users\\KleinZebastianCatapa\\Documents\\INSIGHTEDCODES2026\\public\\Masterlist 2026-2030 139706 CL - with Cong-Gov-Mayor.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get headers (first row)
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];

    // Get first few rows of data to infer types
    const data = XLSX.utils.sheet_to_json(sheet).slice(0, 3);

    console.log("Headers:", JSON.stringify(headers, null, 2));
    console.log("Sample Data:", JSON.stringify(data, null, 2));
} catch (error) {
    console.error("Error reading file:", error);
}
