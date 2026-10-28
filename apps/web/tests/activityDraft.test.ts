import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import {
  activityToDraft, changeDemoActivityStatus, createDemoActivity, editDemoActivity,
  initialActivityDraft, isValidCivilDate, parseParticipants, validateActivityDraft,
} from '../src/activityDraft';
import { addClassMap } from '../src/exportClassMap';

function validDraft() {
  return {
    ...initialActivityDraft('2026-11-17'),
    title: 'Estágio de exemplo',
    location: 'Vilamoura (exemplo)',
    end: '2026-11-19',
    expectedAthletes: 3,
    participantLines: 'Atleta 01\nAtleta 02',
  };
}

test('Formulário cria atividade multi-dia e mantém previsto diferente dos nomes indicados', () => {
  const activity = createDemoActivity(validDraft(), 'demo-test-1');
  assert.equal(activity.start, '2026-11-17');
  assert.equal(activity.end, '2026-11-19');
  assert.equal(activity.coach, 'Treinador de demonstração');
  assert.equal(activity.expectedAthletes, 3);
  assert.deepEqual(activity.participants, ['Atleta 01', 'Atleta 02']);
  assert.equal(activity.status, 'PLANNED');
});

test('Atividade criada alimenta o mesmo mapa Excel sem duplicar dias da classe', () => {
  const activity = createDemoActivity(validDraft(), 'demo-test-2');
  const workbook = new ExcelJS.Workbook();
  const map = addClassMap(workbook, [activity], 2026, 10);
  assert.equal(map.getCell('B7').value, 3);
  assert.equal(map.getCell(7, 19).value, 1); // 17 de novembro
  assert.equal(map.getCell(7, 21).value, 1); // 19 de novembro
});

test('Datas inválidas, invertidas e impossíveis são rejeitadas', () => {
  assert.equal(isValidCivilDate('2028-02-29'), true);
  assert.equal(isValidCivilDate('2027-02-29'), false);
  assert.equal(isValidCivilDate('2026-11-31'), false);
  assert.equal(isValidCivilDate('2026-13-01'), false);
  assert.match(validateActivityDraft({ ...validDraft(), end: '2026-11-16' }) ?? '', /fim/);
  assert.match(validateActivityDraft({ ...validDraft(), start: '2026-11-31' }) ?? '', /datas válidas/);
});

test('Nomes em excesso, duplicados e número previsto incorreto são rejeitados', () => {
  assert.match(validateActivityDraft({
    ...validDraft(), expectedAthletes: 1,
  }) ?? '', /mais nomes/);
  assert.match(validateActivityDraft({
    ...validDraft(), participantLines: 'Atleta 01\n  ATLETA 01  ',
  }) ?? '', /repetidos/);
  assert.match(validateActivityDraft({
    ...validDraft(), expectedAthletes: -1,
  }) ?? '', /inteiro/);
  assert.equal(parseParticipants(' Atleta 01 \r\n\r\n Atleta 02 ' ).length, 2);
});

test('Validação impede classes desconhecidas e dados incompletos', () => {
  assert.match(validateActivityDraft({ ...validDraft(), sailingClass: 'DESCONHECIDA' }) ?? '', /classe/);
  assert.match(validateActivityDraft({ ...validDraft(), title: '  ' }) ?? '', /título/);
  assert.equal(validateActivityDraft({ ...validDraft(), participantLines: '' }), null);
  assert.equal(validateActivityDraft({
    ...validDraft(), expectedAthletes: 0, participantLines: '',
  }), null);
});

test('Criação com dados inválidos lança erro e não gera atividade', () => {
  assert.throws(() => createDemoActivity({ ...validDraft(), end: '2026-11-14' }, 'demo-test-3'));
});


test('Edição usa valores existentes e preserva ID e treinador', () => {
  const old = createDemoActivity(validDraft(), 'original-17');
  const edit = activityToDraft(old);
  assert.equal(edit.start, old.start);
  assert.equal(edit.participantLines, 'Atleta 01\nAtleta 02');
  const saved = editDemoActivity(old, {
    ...edit, title: 'Campeonato da Europa (exemplo)',
    type: 'COMPETITION', sailingClass: '49er FX',
    start: '2026-12-01', end: '2026-12-04',
    location: 'França', expectedAthletes: 5,
    participantLines: 'Atleta 03\nAtleta 04\nAtleta 05',
    status: 'CONFIRMED',
  });
  assert.equal(saved.id, old.id);
  assert.equal(saved.coach, old.coach);
  assert.equal(saved.location, 'França');
  assert.equal(saved.type, 'COMPETITION');
  assert.equal(saved.sailingClass, '49er FX');
  assert.equal(saved.expectedAthletes, 5);
  assert.deepEqual(saved.participants, ['Atleta 03', 'Atleta 04', 'Atleta 05']);
  assert.equal(saved.status, 'CONFIRMED');
  assert.equal(old.title, 'Estágio de exemplo'); // atualização imutável
  assert.equal(old.start, '2026-11-17');
});

test('Cancelar e reativar mantém o registo e altera a contagem do mapa Excel', () => {
  const old = createDemoActivity(validDraft(), 'original-17');
  const cancelled = changeDemoActivityStatus(old, 'CANCELLED');
  assert.equal(cancelled.id, old.id);
  assert.deepEqual(cancelled.participants, old.participants);
  assert.equal(old.status, 'PLANNED');
  const wb = new ExcelJS.Workbook();
  const map = addClassMap(wb, [cancelled], 2026, 10);
  assert.equal(map.getCell('B7').value, 0);
  assert.equal(map.getCell(7, 19).value, '×');
  const reactivated = changeDemoActivityStatus(cancelled, 'PLANNED');
  assert.equal(reactivated.status, 'PLANNED');
  assert.equal(reactivated.id, old.id);
  const wb2 = new ExcelJS.Workbook();
  assert.equal(addClassMap(wb2, [reactivated], 2026, 10).getCell('B7').value, 3);
});

test('Edição rejeita datas incorretas, nomes duplicados e atleta previsto insuficiente', () => {
  const old = createDemoActivity(validDraft(), 'original-17');
  const edit = activityToDraft(old);
  assert.throws(() => editDemoActivity(old, { ...edit, end: '2026-11-16' }), /fim/);
  assert.throws(() => editDemoActivity(old, { ...edit, participantLines: 'Atleta 01\nATLETA 01' }), /repetidos/);
  assert.throws(() => editDemoActivity(old, { ...edit, expectedAthletes: 1 }), /mais nomes/);
  assert.equal(editDemoActivity(old, { ...edit, status: 'COMPLETED' }).status, 'COMPLETED');
  assert.equal(editDemoActivity(old, { ...edit, status: 'CANCELLED' }).status, 'CANCELLED');
});

test('Uma nova atividade não pode ser criada diretamente como realizada ou cancelada', () => {
  assert.throws(() => createDemoActivity({ ...validDraft(), status: 'COMPLETED' }, 'x'), /prevista/);
  assert.throws(() => createDemoActivity({ ...validDraft(), status: 'CANCELLED' }, 'y'), /prevista/);
});

test('Edição de eventos atravessando meses altera o mapa de origem e destino', () => {
  const old = createDemoActivity(validDraft(), 'original-17');
  const edited = editDemoActivity(old, {
    ...activityToDraft(old), start: '2026-12-29', end: '2027-01-04',
  });
  const wb = new ExcelJS.Workbook();
  assert.equal(addClassMap(wb, [edited], 2026, 11).getCell('B7').value, 3);
  assert.equal(addClassMap(wb, [edited], 2027, 0).getCell('B7').value, 4);
  assert.equal(addClassMap(wb, [edited], 2026, 10).getCell('B7').value, 0);
});
