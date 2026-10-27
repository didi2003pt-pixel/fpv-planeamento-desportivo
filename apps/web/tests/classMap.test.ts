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
  const classNames = Array.from({ length: map.rowCount }, (_, index) =>
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
