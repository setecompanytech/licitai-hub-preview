import ExcelJS from 'exceljs';

/** Create a workbook, add sheets from array-of-arrays, and trigger download */
export async function writeExcelFile(
  filename: string,
  sheets: { name: string; data: any[][]; colWidths?: number[] }[]
) {
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    for (const row of sheet.data) {
      ws.addRow(row);
    }
    if (sheet.colWidths) {
      sheet.colWidths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });
    }
  }
  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
}

/** Create a workbook from JSON objects (like XLSX.utils.json_to_sheet) */
export async function writeExcelFromJson(
  filename: string,
  sheetName: string,
  data: Record<string, any>[],
  colWidths?: number[]
) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = [headers, ...data.map(row => headers.map(h => row[h]))];
  await writeExcelFile(filename, [{ name: sheetName, data: rows, colWidths }]);
}

/** Read an Excel/CSV file and return rows as array of objects */
export async function readExcelFile(file: File): Promise<Record<string, any>[]> {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) return [];

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, colNum) => {
    headers[colNum - 1] = String(cell.value ?? '');
  });

  const results: Record<string, any>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, any> = {};
    let hasData = false;
    headers.forEach((h, i) => {
      const val = row.getCell(i + 1).value;
      obj[h] = val;
      if (val !== null && val !== undefined && String(val).trim()) hasData = true;
    });
    if (hasData) results.push(obj);
  }
  return results;
}

/** Read an Excel file and return rows as array of arrays (like XLSX.utils.sheet_to_json with header:1) */
export async function readExcelAsArrays(file: File): Promise<any[][]> {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: any[][] = [];
  ws.eachRow((row) => {
    const vals: any[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      while (vals.length < colNum - 1) vals.push(undefined);
      vals.push(cell.value);
    });
    rows.push(vals);
  });
  return rows;
}

function downloadBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
