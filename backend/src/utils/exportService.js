const ExcelJS = require('exceljs');

/**
 * Genera un buffer .xlsx de una sola hoja a partir de columnas
 * {header, key, width} y filas de objetos planos.
 */
async function rowsToExcelBuffer({ sheetName = 'Reporte', columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  rows.forEach(r => sheet.addRow(r));
  return workbook.xlsx.writeBuffer();
}

/** CSV simple (sin dependencias): escapa comillas y separa por coma. */
function rowsToCSV({ columns, rows }) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(c => escape(c.header)).join(',');
  const lines = rows.map(r => columns.map(c => escape(r[c.key])).join(','));
  return '﻿' + [header, ...lines].join('\r\n'); // BOM para que Excel detecte UTF-8
}

module.exports = { rowsToExcelBuffer, rowsToCSV };
