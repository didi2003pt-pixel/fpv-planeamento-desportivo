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
    const activityTypes = Object.values(typeMeta);
    activityTypes.forEach((meta, index) => {
      const legendCell = sheet.getCell(3, index + 1);
      legendCell.value = '● ' + meta.label;
      legendCell.font = { name: 'Aptos', size: 10, bold: true,
        color: { argb: 'FF' + meta.color.slice(1).toUpperCase() } };
      legendCell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    sheet.getCell('G3').value = 'LEGENDA';
    sheet.getCell('G3').font = { name: 'Aptos', size: 9, bold: true,
      color: { argb: 'FF72829A' } };
    sheet.getCell('G3').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 25;

    for (let col = 1; col <= 7; col += 1) {
      const header = sheet.getCell(4, col);
      header.value = weekdays[col - 1];
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EFF8' } };
      header.font = { name: 'Aptos', bold: true, color: { argb: 'FF173052' } };
      header.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getColumn(col).width = 27;
    }
    sheet.getRow(4).height = 25;

    const weekdayOffset = (monthDate.getDay() + 6) % 7;
    const firstMonday = new Date(year, month, 1 - weekdayOffset);
    const busiestDayPerWeek = Array<number>(6).fill(0);
    for (let index = 0; index < 42; index += 1) {
      const cursor = new Date(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate() + index);
      const iso = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, '0'),
        String(cursor.getDate()).padStart(2, '0'),
      ].join('-');
      const withinMonth = cursor.getMonth() === month;
      const rowNumber = 5 + Math.floor(index / 7);
      const cell = sheet.getCell(rowNumber, 1 + (index % 7));
      const matching = withinMonth ? events.filter((a) => inDay(a, iso)) : [];
      busiestDayPerWeek[Math.floor(index / 7)] = Math.max(
        busiestDayPerWeek[Math.floor(index / 7)], matching.length,
      );

      // Cada atividade mantém a sua cor, inclusive nos dias com tipos diferentes.
      // Não aplicar a cor da primeira atividade ao fundo do dia inteiro.
      const richText = [{
        text: String(cursor.getDate()),
        font: { name: 'Aptos', size: 11, bold: true,
          color: { argb: withinMonth ? 'FF173052' : 'FFA1AEC0' } },
      }];
      for (const activity of matching.slice(0, 4)) {
        const color = typeMeta[activity.type].color.slice(1).toUpperCase();
        const cancelled = activity.status === 'CANCELLED';
        richText.push({
          text: '\n' + (cancelled ? '× ' : '● ') + activity.sailingClass + ' · ' + activity.title,
          font: { name: 'Aptos', size: 9, bold: true,
            color: { argb: cancelled ? 'FF9DA7B5' : 'FF' + color } },
        });
      }
      if (matching.length > 4) {
        richText.push({
          text: '\n+' + (matching.length - 4) + ' atividades (ver lista)',
          font: { name: 'Aptos', size: 9, bold: true, color: { argb: 'FF65768A' } },
        });
      }
      cell.value = { richText };
      cell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFDCE4EF' } },
        right: { style: 'hair', color: { argb: 'FFDCE4EF' } },
      };
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: !withinMonth ? 'FFF1F4F8'
          : matching.length ? 'FFF3F8FE'
          : index % 7 >= 5 ? 'FFFAFBFD' : 'FFFFFFFF' },
      };
    }
    busiestDayPerWeek.forEach((count, index) => {
      // Altura ajustada por semana; a lista de atividades contém todos os registos.
      sheet.getRow(5 + index).height = Math.min(145, 62 + Math.min(count, 5) * 17);
    });

    sheet.mergeCells('A12:G12');
    sheet.getCell('A12').value = 'DEMONSTRAÇÃO — dados fictícios; não é um planeamento oficial.';
    sheet.getCell('A12').font = { name: 'Aptos', italic: true,
      color: { argb: 'FF66778C' }, size: 10 };
    sheet.getRow(12).height = 23;
    sheet.mergeCells('A13:G13');
    sheet.getCell('A13').value = 'Nos dias com mais de quatro atividades, consulta o detalhe completo no separador Atividades.';
    sheet.getCell('A13').font = { name: 'Aptos', italic: true,
      color: { argb: 'FF66778C' }, size: 10 };
    sheet.getRow(13).height = 23;
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printArea: 'A1:G13' };
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
