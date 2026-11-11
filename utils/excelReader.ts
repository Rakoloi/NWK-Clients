import * as XLSX from 'xlsx';
import * as path from 'path';

export function getWorkbookData() {

    const filePath = path.resolve(__dirname,'clientsData.xlsx');

    const workbook = XLSX.readFile(filePath);

    const data: Record<string, any[]> = {};

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];

        data[sheetName] = XLSX.utils.sheet_to_json(sheet, {
        defval: ''
        });
    });

    console.log("data found and code ran")

    return data;
}