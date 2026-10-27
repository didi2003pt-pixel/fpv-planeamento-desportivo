import type { DemoActivity } from './demo';
import { statusLabel, typeMeta } from './demo';

const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function inDay(activity: DemoActivity, day: string): boolean {
  return activity.start <= day && activity.end >= day;
}

export async function exportDemoExcel(
  events: DemoActivity[], date: Date, fullYear: boolean,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FPV Planeamento Desportivo — demonstração';
  workbook.created = new Date();

  const list = workbook.addWorksheet('Atividades');
  list.columns = [
    { header: 'Classe', key: 'classe', width: 18 },
    { header: 'Atividade', key: 'titulo', width: 32 },
    { header: 'Tipo', key: 'tipo', width: 18 },
    { header: 'Estado', key: 'estado', width: 17 },
    { header: 'Início', key: 'inicio', width: 15 },
    { header: 'Fim', key: 'fim', width: 15 },
    { header: 'Local', key: 'local', width: 27 },
    { header: 'Treinador', key: 'treinador', width: 30 },
    { header: 'Atletas previstos', key: 'previstos', width: 20 },
    { header: 'Participantes indicados', key: 'participantes', width: 55 },
  ];
  list.getRow(1).height = 27;
  list.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173052' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle' };
  });
  events.forEach((a) => {
    const row = list.addRow({
      classe: a.sailingClass, titulo: a.title, tipo: typeMeta[a.type].label,
      estado: statusLabel[a.status], inicio: a.start, fim: a.end,
      local: a.location, treinador: a.coach, previstos: a.expectedAthletes,
      participantes: a.participants.join(', '),
    });
    const hex = typeMeta[a.type].color.slice(1).toUpperCase();
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
    row.getCell(3).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    row.alignment = { vertical: 'middle' };
  });
  list.autoFilter = { from: 'A1', to: 'J' + Math.max(2, list.rowCount) };
  list.views = [{ state: 'frozen', ySplit: 1 }];
  list.pageSetup.orientation = 'landscape';

  const year = date.getFullYear();
  const months = fullYear ? Array.from({ length: 12 }, (_, i) => i) : [date.getMonth()];
  for (const month of months) {
    const monthDate = new Date(year, month, 1);
    const monthTitle = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(monthDate);
    const sheet = workbook.addWorksheet('Calendário ' + String(month + 1).padStart(2, '0'));
    sheet.mergeCells('A1:G2');
    const title = sheet.getCell('A1');
    title.value = 'FPV · Planeamento · ' + monthTitle.toUpperCase();
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173052' } };
    title.font = { size: 17, bold: true, color: { argb: 'FFFFFFFF' } };
    title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    for (let col = 1; col <= 7; col += 1) {
      const header = sheet.getCell(4, col);
      header.value = weekdays[col - 1];
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EFF8' } };
      header.font = { bold: true, color: { argb: 'FF173052' } };
      header.alignment = { horizontal: 'center' };
      sheet.getColumn(col).width = 24;
    }
    const weekdayOffset = (monthDate.getDay() + 6) % 7;
    const firstMonday = new Date(year, month, 1 - weekdayOffset);
    for (let index = 0; index < 42; index += 1) {
      const cursor = new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + index);
      const iso = [cursor.getFullYear(), String(cursor.getMonth() + 1).padStart(2, '0'), String(cursor.getDate()).padStart(2, '0')].join('-');
      const rowNumber = 5 + Math.floor(index / 7);
      const cell = sheet.getCell(rowNumber, 1 + (index % 7));
      const matching = events.filter((a) => inDay(a, iso));
      const summary = matching.slice(0, 3).map((a) => a.sailingClass + ' · ' + a.title);
      if (matching.length > 3) summary.push('+' + (matching.length - 3) + ' atividades');
      cell.value = cursor.getDate() + (summary.length ? '\n' + summary.join('\n') : '');
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE4EF' } },
                      right: { style: 'hair', color: { argb: 'FFDCE4EF' } } };
      if (matching.length > 0 && cursor.getMonth() === month) {
        const fill = typeMeta[matching[0].type].color.slice(1).toUpperCase();
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + fill } };
        cell.font = { color: { argb: 'FFFFFFFF' }, size: 10 };
      } else if (cursor.getMonth() !== month) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F4F8' } };
        cell.font = { color: { argb: 'FF9AA7B7' }, size: 10 };
      } else {
        cell.font = { color: { argb: 'FF173052' }, size: 10 };
      }
      sheet.getRow(rowNumber).height = 78;
    }
    sheet.getCell('A12').value = 'DEMONSTRAÇÃO — dados fictícios; não é um planeamento oficial.';
    sheet.getCell('A12').font = { italic: true, color: { argb: 'FF66778C' } };
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 };
  }

  const output = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(output)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fpv-planeamento-demo-' + year + (fullYear ? '-anual' : '-' + String(date.getMonth() + 1).padStart(2, '0')) + '.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
