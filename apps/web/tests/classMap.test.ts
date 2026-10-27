import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { addClassMap, countClassDays, fpvReferenceClasses, referenceClassName } from '../src/exportClassMap';
import type { DemoActivity } from '../src/demo';

const record = (
  id: string, type: DemoActivity['type'], start: string, end: string,
  status: DemoActivity['status'] = 'PLANNED',
): DemoActivity => ({
  id, type, start, end, status,
  title: 'Atividade de teste', sailingClass: 'ILCA 7',
  location: 'Local fictício', coach: 'Treinador fictício',
  expectedAthletes: 3, participants: [],
});

test('O catálogo respeita as 17 linhas da referência FPV 2026', () => {
  assert.equal(fpvReferenceClasses.length, 17);
  assert.equal(referenceClassName('49 ER FX'), '49er FX');
  assert.equal(referenceClassName('ilca - 7'), 'ILCA 7');
  assert.equal(referenceClassName('Formula Kite F'), 'Formula Kite F');
});

test('Dias-classe únicos: atividades simultâneas não duplicam dias', () => {
  const records = [
    record('A', 'CAMP', '2026-10-17', '2026-10-27'),
    record('B', 'COMPETITION', '2026-10-18', '2026-10-19'),
    record('C', 'TRAINING', '2026-10-29', '2026-10-29', 'CANCELLED'),
  ];
  assert.equal(countClassDays(records, 2026, 9), 11);
  assert.equal(countClassDays(records, 2026, 10), 0);

  const wb = new ExcelJS.Workbook();
  const map = addClassMap(wb, records, 2026, 9);
  assert.equal(map.name, 'Mapa Classes 10');
  assert.equal(map.getCell('B7').value, 11);
  assert.equal(map.getCell(7, 19).value, 1); // 17/10
  assert.equal(map.getCell(8, 20).value, 1); // 18/10: competição
  assert.equal(map.getCell(9, 20).value, 1); // 18/10: estágio no mesmo dia
  assert.equal(map.getCell(7, 31).value, '×'); // 29/10 só cancelada
  assert.equal(map.getCell(12, 1).value, 'ILCA 6');
});

test('Mês com 29 dias e eventos que atravessam a fronteira do mês', () => {
  const wb = new ExcelJS.Workbook();
  const item = record('A', 'TRAINING', '2028-02-27', '2028-03-02');
  const feb = addClassMap(wb, [item], 2028, 1);
  assert.equal(feb.getCell(5, 31).value, 29); // 29 fevereiro
  assert.equal(feb.getCell(5, 32).value, ''); // 30 inválido
  assert.equal(feb.getCell('B7').value, 3);
  assert.equal(countClassDays([item], 2028, 2), 2);
});

test('O Excel produzido é legível ao voltar a importar', async () => {
  const wb = new ExcelJS.Workbook();
  addClassMap(wb, [record('A', 'CAMP', '2026-10-17', '2026-10-27')], 2026, 9);
  const file = await wb.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(file as Buffer);
  assert.equal(loaded.getWorksheet('Mapa Classes 10')?.getCell('B7').value, 11);
});

test('Classes sem atividades mantêm resumo, mas não criam três sublinhas vazias', () => {
  const wb = new ExcelJS.Workbook();
  const camp = record('A', 'CAMP', '2026-10-17', '2026-10-27');
  const future = record('B', 'COMPETITION', '2026-11-02', '2026-11-03');
  const map = addClassMap(wb, [camp, future], 2026, 9);
  assert.equal(map.getCell('A7').value, 'ILCA 7');
  assert.equal(map.getCell('A8').value, '  Estágio');
  assert.equal(map.getCell('A10').value, 'ILCA 6');
  assert.equal(map.getCell('B10').value, 0);
  assert.equal(map.getCell('A11').value, '470 MX');
  // Contar apenas o bloco principal, não repetir classes que surgem
  // legitimamente na tabela descritiva de provas e estágios.
  const summaryRow = Array.from({ length: map.rowCount }, (_, index) => index + 1)
    .find((row) => String(map.getCell(row, 1).value).startsWith('RESUMO  ·'));
  assert.ok(summaryRow);
  const classNames = Array.from({ length: summaryRow - 1 }, (_, index) =>
    map.getCell(index + 1, 1).value).filter((value) =>
      typeof value === 'string' && fpvReferenceClasses.includes(value as typeof fpvReferenceClasses[number]));
  assert.equal(classNames.length, fpvReferenceClasses.length);
});

test('Cancelamento isolado mantém a categoria visível sem aumentar os dias-classe', () => {
  const wb = new ExcelJS.Workbook();
  const cancelled = record('X', 'TRAINING', '2026-10-29', '2026-10-29', 'CANCELLED');
  const map = addClassMap(wb, [cancelled], 2026, 9);
  assert.equal(map.getCell('B7').value, 0);
  assert.equal(map.getCell('A8').value, '  Treino');
  assert.equal(map.getCell(7, 31).value, '×');
  assert.equal(map.getCell(8, 31).value, '×');
});


test('Na própria folha, provas e estágios mostram título, local, datas e notas nas células', async () => {
  const worlds = {
    ...record('M', 'COMPETITION', '2026-11-17', '2026-11-20'),
    title: 'Campeonato do Mundo (exemplo)', location: 'Polónia',
  };
  const europe = {
    ...record('E', 'COMPETITION', '2026-11-19', '2026-11-22'),
    title: 'Campeonato da Europa (exemplo)', location: 'França',
  };
  const camp = {
    ...record('S', 'CAMP', '2026-11-18', '2026-11-21'),
    title: 'Estágio de preparação (exemplo)', location: 'Vilamoura',
  };
  const wb = new ExcelJS.Workbook();
  const sheet = addClassMap(wb, [worlds, europe, camp], 2026, 10);

  // Os 19 de novembro têm duas provas simultâneas e um estágio.
  const summaryNote = sheet.getCell(7, 21).note;
  assert.match(String(summaryNote), /Campeonato do Mundo \(exemplo\)/);
  assert.match(String(summaryNote), /Campeonato da Europa \(exemplo\)/);
  assert.match(String(summaryNote), /Estágio de preparação \(exemplo\)/);
  assert.match(String(summaryNote), /Polónia/);
  assert.match(String(summaryNote), /França/);
  assert.match(String(sheet.getCell(8, 21).note), /Campeonato da Europa/);
  assert.match(String(sheet.getCell(9, 21).note), /Vilamoura/);

  // Cada prova ou estágio aparece com o respetivo local e datas numa
  // tabela legível, colocada abaixo do mapa na MESMA folha.
  const rows: { row: number; title: string }[] = [];
  for (let row = 1; row <= sheet.rowCount; row += 1) {
    const title = sheet.getCell(row, 6).value;
    if (typeof title === 'string') rows.push({ row, title });
  }
  for (const [title, location] of [
    ['Campeonato do Mundo (exemplo)', 'Polónia'],
    ['Campeonato da Europa (exemplo)', 'França'],
    ['Estágio de preparação (exemplo)', 'Vilamoura'],
  ]) {
    const found = rows.find((item) => item.title === title);
    assert.ok(found, title + ' não foi encontrado na tabela da própria folha');
    assert.equal(sheet.getCell(found.row, 15).value, location);
    assert.equal(sheet.getCell(found.row, 23).value, '2026-11-' +
      (title.includes('Mundo') ? '17 a 2026-11-20' : title.includes('Europa') ? '19 a 2026-11-22' : '18 a 2026-11-21'));
  }
  const xlsx = await wb.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(xlsx as Buffer);
  const loadedMap = loaded.getWorksheet('Mapa Classes 11');
  assert.ok(loadedMap);
  assert.match(String(loadedMap.getCell(7, 21).note), /Polónia/);
});

test('Prova que começa antes do mês continua identificada e o mês vazio tem mensagem própria', () => {
  const wb = new ExcelJS.Workbook();
  const crossover = {
    ...record('A', 'CAMP', '2026-10-30', '2026-11-03'),
    title: 'Estágio com transição de mês', location: 'Faro',
  };
  const november = addClassMap(wb, [crossover], 2026, 10);
  assert.match(String(november.getCell(7, 3).note), /Faro/);
  const titles: string[] = [];
  for (let row = 1; row <= november.rowCount; row += 1) {
    const value = november.getCell(row, 6).value;
    if (typeof value === 'string') titles.push(value);
  }
  assert.ok(titles.includes('Estágio com transição de mês'));
  const december = addClassMap(wb, [], 2026, 11);
  assert.ok(Array.from({ length: december.rowCount }, (_, i) => december.getCell(i + 1, 1).value)
    .includes('Sem provas ou estágios registados neste mês.'));
});
