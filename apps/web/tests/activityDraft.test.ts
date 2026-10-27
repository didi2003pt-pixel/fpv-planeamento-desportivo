import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import {
  createDemoActivity, initialActivityDraft, isValidCivilDate,
  parseParticipants, validateActivityDraft,
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
