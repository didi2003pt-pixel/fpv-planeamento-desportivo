import type { Workbook, Worksheet } from 'exceljs';
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

function background(cell: Worksheet['getCell'] extends (...args: never[]) => infer R ? R : never, color: string): void {
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

  const catalogue = [...fpvReferenceClasses];
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
    const cell = sheet.getCell(4, index + 3);
    cell.value = '● ' + typeMeta[type].label;
    cell.font = { name: 'Aptos', size: 9, bold: true,
      color: hex('FF' + typeMeta[type].color.slice(1).toUpperCase()) };
    sheet.mergeCells(4, index + 3, 4, index + 5);
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

  let cursor = 7;
  let classDays = 0;
  let activeClasses = 0;
  let cancelledDays = 0;
  for (const className of catalogue) {
    const classEvents = allEvents.filter((e) =>
      cleanClass(referenceClassName(e.sailingClass)) === cleanClass(className));
    const usedTypes = [...baseTypes, ...remainingTypes.filter((t) =>
      classEvents.some((event) => event.type === t)
      || (className.startsWith('Formação ') && t === 'EDUCATION'))];
    const classCount = countClassDays(classEvents, year, monthIndex);
    classDays += classCount;
    if (classCount) activeClasses += 1;

    const summary = sheet.getRow(cursor);
    summary.height = 24;
    const summaryLabel = summary.getCell(1);
    summaryLabel.value = className;
    background(summaryLabel, lightBlue);
    summaryLabel.font = { name: 'Aptos', bold: true, size: 10, color: hex(navy) };
    summaryLabel.alignment = { vertical: 'middle', indent: 1 };
    summary.getCell(2).value = classCount;
    background(summary.getCell(2), lightBlue);
    summary.getCell(2).font = { name: 'Aptos', bold: true, size: 11, color: hex(navy) };
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
      if (cancelled > 0 && active === 0) cancelledDays += 1;
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
    sheet.getRow(cursor).height = 8;
    cursor += 1;
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
    '1 = classe ativa nesse dia; nas sublinhas, o número indica atividades do mesmo tipo; × = apenas canceladas. ' +
    'Sublinhas podem sobrepor-se: não somar os seus totais para obter dias-classe.';
  sheet.getCell(footerRow + 1, 1).font = { name: 'Aptos', italic: true, size: 10,
    color: hex(dark) };
  sheet.getRow(footerRow + 1).height = 22;

  sheet.mergeCells(footerRow + 2, 1, footerRow + 2, 33);
  sheet.getCell(footerRow + 2, 1).value =
    'DEMONSTRAÇÃO — atividades fictícias. Datas, locais, participantes e nomes detalhados constam na folha Atividades. ' +
    'A ausência de atividades reais não significa que não tenham ocorrido.';
  sheet.getCell(footerRow + 2, 1).font = { name: 'Aptos', italic: true, size: 10, color: hex(grey) };
  sheet.getRow(footerRow + 2).height = 22;

  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 6, topLeftCell: 'C7' }];
  sheet.pageSetup = {
    paperSize: 8, // A3 landscape, com 31 dias: mais legível do que A4.
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: 'A1:AG' + (footerRow + 2),
    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 },
  };
  return sheet;
}
