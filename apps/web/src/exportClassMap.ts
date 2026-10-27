import type { Workbook, Worksheet, Cell } from 'exceljs';
import { typeMeta, type ActivityType, type DemoActivity } from './demo';

/**
 * As 17 linhas principais (15 classes + 2 áreas de formação) seguem a ordem
 * da folha "2026" do planeamento de referência recebido da FPV.
 *
 * Sem dados pessoais nem atividades reais no repositório público.
 */
export const fpvReferenceClasses = [
  'ILCA 7', 'ILCA 6', '470 MX', '49er', '49er FX',
  'Formula Kite M', 'Formula Kite F', 'IQFOIL', 'TECHNO 293',
  '420', 'Optimist', 'ILCA 4', '29er', 'Hansa', 'RS Venture',
  'Formação Atletas', 'Formação Treinadores',
] as const;

const baseTypes: ActivityType[] = ['COMPETITION', 'CAMP', 'TRAINING'];
const remainingTypes: ActivityType[] = ['TRAVEL', 'EDUCATION', 'OTHER'];

const navy = 'FF173052';
const dark = 'FF273F60';
const lightBlue = 'FFEAF2FC';
const pale = 'FFF4F7FC';
const faded = 'FFE4EAF2';
const grey = 'FF79879B';

function cleanClass(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
}

export function referenceClassName(value: string): string {
  const key = cleanClass(value);
  return fpvReferenceClasses.find((name) => cleanClass(name) === key) ?? value.trim();
}

function hex(argb: string): { argb: string } {
  return { argb };
}

function background(cell: Cell, color: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(color) };
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return [year, String(monthIndex + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function isInDay(event: DemoActivity, iso: string): boolean {
  return event.start <= iso && event.end >= iso;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function uniqueDays(events: DemoActivity[], year: number, month: number, skipCancelled = true): number {
  const days = daysInMonth(year, month);
  let active = 0;
  for (let day = 1; day <= days; day += 1) {
    const iso = isoDate(year, month, day);
    if (events.some((event) => (!skipCancelled || event.status !== 'CANCELLED') && isInDay(event, iso))) {
      active += 1;
    }
  }
  return active;
}

/** Dias-classe únicos por mês: evita dupla contagem de eventos sobrepostos. */
export function countClassDays(events: DemoActivity[], year: number, month: number): number {
  return uniqueDays(events, year, month);
}

function writeDayCell(
  sheet: Worksheet, row: number, col: number, active: number, cancelled: number,
  type: ActivityType | undefined, summary: boolean, weekend: boolean,
): void {
  const cell = sheet.getCell(row, col);
  if (active > 0) {
    cell.value = summary ? 1 : active;
    background(cell, summary ? 'FFDCECFB' : 'FF' + typeMeta[type!].color.slice(1).toUpperCase());
    cell.font = { name: 'Aptos', size: 10, bold: true,
      color: hex(summary ? dark : 'FFFFFFFF') };
  } else if (cancelled > 0) {
    cell.value = '×';
    background(cell, 'FFF1F1F3');
    cell.font = { name: 'Aptos', size: 10, bold: true, color: hex('FF969FAF') };
  } else {
    background(cell, weekend ? 'FFF4F7FB' : 'FFFFFFFF');
  }
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = { right: { style: 'hair', color: hex(faded) },
    bottom: { style: 'hair', color: hex(faded) } };
}

export function addClassMap(
  workbook: Workbook, allEvents: DemoActivity[], year: number, monthIndex: number,
): Worksheet {
  if (monthIndex < 0 || monthIndex > 11) {
    throw new RangeError('Mês inválido para o mapa mensal');
  }
  const month = String(monthIndex + 1).padStart(2, '0');
  const days = daysInMonth(year, monthIndex);
  const monthName = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthIndex, 1));
  const sheet = workbook.addWorksheet('Mapa Classes ' + month);

  const catalogue: string[] = [...fpvReferenceClasses];
  const knownKeys = new Set(catalogue.map(cleanClass));
  for (const event of allEvents) {
    const normalized = referenceClassName(event.sailingClass);
    if (!knownKeys.has(cleanClass(normalized))) {
      knownKeys.add(cleanClass(normalized));
      catalogue.push(normalized);
    }
  }

  sheet.getColumn(1).width = 31;
  sheet.getColumn(2).width = 12;
  for (let col = 3; col <= 33; col += 1) {
    sheet.getColumn(col).width = 5.25;
  }

  sheet.mergeCells('A1:AG2');
  const title = sheet.getCell('A1');
  title.value = 'FPV  |  MAPA MENSAL POR CLASSE  |  ' + monthName.toUpperCase();
  background(title, navy);
  title.font = { name: 'Aptos Display', size: 18, bold: true, color: hex('FFFFFFFF') };
  title.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 17;

  sheet.mergeCells('A3:AG3');
  const subtitle = sheet.getCell('A3');
  subtitle.value = 'Referência: lógica do plano FPV de 2026  ·  Cada 1 da linha da classe representa um dia com atividade  ·  Vista filtrada';
  subtitle.font = { name: 'Aptos', size: 10, color: hex(dark) };
  subtitle.alignment = { vertical: 'middle', indent: 1 };
  background(subtitle, lightBlue);
  sheet.getRow(3).height = 23;

  sheet.mergeCells('A4:B4');
  sheet.getCell('A4').value = 'TIPO DE ATIVIDADE';
  sheet.getCell('A4').font = { name: 'Aptos', size: 9, bold: true, color: hex(grey) };
  for (const [index, type] of [...baseTypes, ...remainingTypes].entries()) {
    const firstLegendCol = 3 + index * 3;
    const cell = sheet.getCell(4, firstLegendCol);
    cell.value = '● ' + typeMeta[type].label;
    cell.font = { name: 'Aptos', size: 9, bold: true,
      color: hex('FF' + typeMeta[type].color.slice(1).toUpperCase()) };
    sheet.mergeCells(4, firstLegendCol, 4, firstLegendCol + 2);
  }
  sheet.getRow(4).height = 23;

  sheet.mergeCells('A5:A6');
  sheet.mergeCells('B5:B6');
  sheet.getCell('A5').value = 'CLASSE / ATIVIDADE';
  sheet.getCell('B5').value = 'DIAS MÊS';
  for (const coord of ['A5', 'B5']) {
    const cell = sheet.getCell(coord);
    background(cell, navy);
    cell.font = { name: 'Aptos', bold: true, size: 10, color: hex('FFFFFFFF') };
    cell.alignment = { horizontal: coord === 'A5' ? 'left' : 'center',
      vertical: 'middle', indent: coord === 'A5' ? 1 : 0 };
  }
  const weekday = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  for (let day = 1; day <= 31; day += 1) {
    const col = day + 2;
    const header = sheet.getCell(5, col);
    const subheader = sheet.getCell(6, col);
    const invalid = day > days;
    const weekend = !invalid && [0, 6].includes(new Date(year, monthIndex, day).getDay());
    const color = invalid ? 'FFE6EAF0' : weekend ? 'FF375474' : navy;
    background(header, color);
    background(subheader, color);
    header.value = invalid ? '' : day;
    subheader.value = invalid ? '' : weekday[new Date(year, monthIndex, day).getDay()];
    for (const cell of [header, subheader]) {
      cell.font = { name: 'Aptos', bold: true, size: 9,
        color: hex(invalid ? grey : 'FFFFFFFF') };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }
  sheet.getRow(5).height = 23;
  sheet.getRow(6).height = 21;

  const firstDay = isoDate(year, monthIndex, 1);
  const lastDay = isoDate(year, monthIndex, days);
  let cursor = 7;
  let classDays = 0;
  let activeClasses = 0;
  for (const className of catalogue) {
    const classEvents = allEvents.filter((e) =>
      cleanClass(referenceClassName(e.sailingClass)) === cleanClass(className));
    // Mostrar apenas sublinhas com atividades neste mês.
    // As 17 classes principais continuam sempre presentes, mesmo sem planeamento.
    const monthlyEvents = classEvents.filter((event) =>
      event.start <= lastDay && event.end >= firstDay);
    const usedTypes = [...baseTypes, ...remainingTypes].filter((type) =>
      monthlyEvents.some((event) => event.type === type));
    const classCount = countClassDays(classEvents, year, monthIndex);
    classDays += classCount;
    if (classCount) activeClasses += 1;

    const summary = sheet.getRow(cursor);
    summary.height = 24;
    const summaryLabel = summary.getCell(1);
    summaryLabel.value = className;
    background(summaryLabel, monthlyEvents.length ? lightBlue : pale);
    summaryLabel.font = { name: 'Aptos', bold: true, size: 10,
      color: hex(monthlyEvents.length ? navy : grey) };
    summaryLabel.alignment = { vertical: 'middle', indent: 1 };
    summary.getCell(2).value = classCount;
    background(summary.getCell(2), monthlyEvents.length ? lightBlue : pale);
    summary.getCell(2).font = { name: 'Aptos', bold: true, size: 11,
      color: hex(monthlyEvents.length ? navy : grey) };
    summary.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

    for (let day = 1; day <= 31; day += 1) {
      const col = day + 2;
      if (day > days) {
        background(summary.getCell(col), 'FFE6EAF0');
        continue;
      }
      const iso = isoDate(year, monthIndex, day);
      const todayEvents = classEvents.filter((event) => isInDay(event, iso));
      const active = todayEvents.filter((event) => event.status !== 'CANCELLED').length;
      const cancelled = todayEvents.length - active;
      writeDayCell(sheet, cursor, col, active, cancelled, undefined, true,
        [0, 6].includes(new Date(year, monthIndex, day).getDay()));
    }
    cursor += 1;

    for (const type of usedTypes) {
      const typeEvents = classEvents.filter((event) => event.type === type);
      const line = sheet.getRow(cursor);
      line.height = 21;
      line.outlineLevel = 1;
      line.getCell(1).value = '  ' + typeMeta[type].label;
      line.getCell(1).font = { name: 'Aptos', size: 10, color: hex(dark) };
      line.getCell(1).alignment = { vertical: 'middle', indent: 1 };
      line.getCell(2).value = uniqueDays(typeEvents, year, monthIndex);
      line.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      line.getCell(2).font = { name: 'Aptos', size: 10, color: hex(grey) };
      for (let day = 1; day <= 31; day += 1) {
        const col = day + 2;
        if (day > days) {
          background(line.getCell(col), 'FFE6EAF0');
          continue;
        }
        const iso = isoDate(year, monthIndex, day);
        const todayEvents = typeEvents.filter((event) => isInDay(event, iso));
        const active = todayEvents.filter((event) => event.status !== 'CANCELLED').length;
        writeDayCell(sheet, cursor, col, active, todayEvents.length - active,
          type, false, [0, 6].includes(new Date(year, monthIndex, day).getDay()));
      }
      cursor += 1;
    }
    // Evita dezenas de separadores sem conteúdo nas classes inativas.
    if (usedTypes.length > 0) {
      sheet.getRow(cursor).height = 7;
      cursor += 1;
    }
  }

  const footerRow = cursor + 1;
  sheet.mergeCells(footerRow, 1, footerRow, 33);
  const totals = sheet.getCell(footerRow, 1);
  totals.value = 'RESUMO  ·  ' + activeClasses + ' classes com atividades  ·  ' +
    classDays + ' dias-classe (sem dupla contagem por dia e classe)';
  background(totals, navy);
  totals.font = { name: 'Aptos', size: 11, bold: true, color: hex('FFFFFFFF') };
  totals.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(footerRow).height = 27;

  sheet.mergeCells(footerRow + 1, 1, footerRow + 1, 33);
  sheet.getCell(footerRow + 1, 1).value =
    '1 = classe ativa nesse dia; as sublinhas aparecem apenas quando o tipo tem atividades no mês; × = apenas canceladas. ' +
    'Os totais por tipo podem sobrepor-se e não devem ser somados para obter dias-classe.';
  sheet.getCell(footerRow + 1, 1).font = { name: 'Aptos', italic: true, size: 10,
    color: hex(dark) };
  sheet.getRow(footerRow + 1).height = 22;

  sheet.mergeCells(footerRow + 2, 1, footerRow + 2, 33);
  sheet.getCell(footerRow + 2, 1).value =
    'DEMONSTRAÇÃO — atividades fictícias. Datas, locais, participantes e nomes detalhados constam na folha Atividades. ' +
    'A ausência de atividades reais não significa que não tenham ocorrido.';
  sheet.getCell(footerRow + 2, 1).font = { name: 'Aptos', italic: true, size: 10, color: hex(grey) };
  sheet.getRow(footerRow + 2).height = 22;

  // A:AG reproduz a grelha FPV já aprovada. Os detalhes ficam
  // exclusivamente à DIREITA (AI:AN), acessíveis pela barra horizontal.
  // Não criar novas linhas abaixo do mapa nem novas folhas.
  sheet.getColumn(34).width = 3; // AH: separador visual.
  const detailColumns = [
    { col: 35, label: 'CLASSE', width: 19 },
    { col: 36, label: 'TIPO', width: 18 },
    { col: 37, label: 'NOME DA PROVA / ESTÁGIO', width: 57 },
    { col: 38, label: 'LOCAL / PAÍS', width: 39 },
    { col: 39, label: 'DATAS', width: 28 },
    { col: 40, label: 'ESTADO', width: 19 },
  ];
  for (const definition of detailColumns) {
    sheet.getColumn(definition.col).width = definition.width;
    sheet.mergeCells(5, definition.col, 6, definition.col);
    const header = sheet.getCell(5, definition.col);
    header.value = definition.label;
    background(header, navy);
    header.font = { name: 'Aptos', size: 10, bold: true, color: hex('FFFFFFFF') };
    header.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  }
  sheet.mergeCells('AI3:AN3');
  const detailsHeading = sheet.getCell('AI3');
  detailsHeading.value = 'FPV  |  IDENTIFICAÇÃO DE PROVAS E ESTÁGIOS  |  ' + monthName.toUpperCase();
  background(detailsHeading, navy);
  detailsHeading.font = { name: 'Aptos', size: 14, bold: true, color: hex('FFFFFFFF') };
  detailsHeading.alignment = { vertical: 'middle', indent: 1 };

  const identified = allEvents.filter((event) =>
    (event.type === 'CAMP' || event.type === 'COMPETITION')
    && event.start <= lastDay && event.end >= firstDay
  ).sort((a, b) => a.start.localeCompare(b.start)
    || a.sailingClass.localeCompare(b.sailingClass)
    || a.title.localeCompare(b.title));
  sheet.mergeCells('AI4:AN4');
  const detailsHelp = sheet.getCell('AI4');
  detailsHelp.value = identified.length
    ? identified.length + ' provas/estágios identificados neste mês (dados de demonstração).'
    : 'Sem provas ou estágios registados neste mês.';
  background(detailsHelp, lightBlue);
  detailsHelp.font = { name: 'Aptos', size: 10, color: hex(dark) };
  detailsHelp.alignment = { vertical: 'middle', indent: 1 };
  for (const [index, event] of identified.entries()) {
    const row = 7 + index;
    const values = [
      referenceClassName(event.sailingClass),
      typeMeta[event.type].label,
      event.title,
      event.location.trim() || 'Por definir',
      event.start + ' a ' + event.end,
      event.status === 'CANCELLED' ? 'Cancelado'
        : event.status === 'CONFIRMED' ? 'Confirmado'
        : event.status === 'COMPLETED' ? 'Realizado' : 'Previsto',
    ];
    for (const [columnIndex, value] of values.entries()) {
      const col = 35 + columnIndex;
      const cell = sheet.getCell(row, col);
      cell.value = value;
      background(cell, index % 2 === 0 ? 'FFFFFFFF' : pale);
      cell.font = { name: 'Aptos', size: 10, bold: columnIndex === 2,
        color: hex(dark) };
      // Manter alturas da grelha A:AG inalteradas. Os textos completos
      // continuam disponíveis ao selecionar a célula no Excel.
      cell.alignment = { vertical: 'middle', indent: 1 };
      cell.border = { bottom: { style: 'hair', color: hex(faded) } };
    }
    const typeCell = sheet.getCell(row, 36);
    background(typeCell, 'FF' + typeMeta[event.type].color.slice(1).toUpperCase());
    typeCell.font = { name: 'Aptos', size: 10, bold: true, color: hex('FFFFFFFF') };
  }
  // A impressão continua limitada ao mapa aprovado (A:AG). Os detalhes
  // são para consulta horizontal no Excel, não comprimem as 31 colunas.

  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 6, topLeftCell: 'C7' }];
  sheet.pageSetup = {
    // OOXML paperSize=8 representa A3; os tipos ExcelJS 4.4 não incluem este valor.
    paperSize: 8 as Worksheet['pageSetup']['paperSize'],
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: 'A1:AG' + (footerRow + 2),
    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 },
  };
  return sheet;
}
