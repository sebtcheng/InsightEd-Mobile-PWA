import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:\\Users\\KleinZebastianCatapa\\Documents\\INSIGHTEDCODES2026\\public\\Masterlist 2026-2030 139706 CL - with Cong-Gov-Mayor.xlsx';

try {
    if (fs.existsSync(filePath)) {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        if (sheet['!ref']) {
            const range = XLSX.utils.decode_range(sheet['!ref']);
            range.e.r = Math.min(range.e.r, 5);
            const newRef = XLSX.utils.encode_range(range);

            const data = XLSX.utils.sheet_to_json(sheet, { range: newRef, header: 1 });

            if (data.length > 0) {
                const output = {
                    headers: data[0],
                    sample: data.slice(1, 4)
                };
                fs.writeFileSync('headers.json', JSON.stringify(output, null, 2));
                console.log("Written to headers.json");
            }
        }
    }
} catch (error) {
    console.error("Error:", error);
}
