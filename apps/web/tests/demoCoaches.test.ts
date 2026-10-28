import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { demoActivities, type DemoActivity } from '../src/demo';
import {
  FEDERATION_VIEW, activitiesForDemoView, appendFictitiousCoach,
  assignDemoCoachClasses, classesForDemoView, demoCoachNameForClass, initialDemoCoaches,
} from '../src/demoCoaches';
import { addClassMap } from '../src/exportClassMap';

test('Federação vê todas as classes, vista de treinador apenas classes atribuídas', () => {
  const coaches = initialDemoCoaches();
  const activities = demoActivities();
  assert.equal(activitiesForDemoView(activities, FEDERATION_VIEW, coaches).length, activities.length);
  const ilca = activitiesForDemoView(activities, 'coach-1', coaches);
  assert.ok(ilca.length > 0);
  assert.ok(ilca.every((activity) => coaches[0].sailingClasses.includes(activity.sailingClass)));
  const unknown = activitiesForDemoView(activities, 'unknown-id', coaches);
  assert.deepEqual(unknown, []);
});

test('Atribuições podem ser alteradas sem modificar as anteriores ou as de outros treinadores', () => {
  const initial = initialDemoCoaches();
  const next = assignDemoCoachClasses(initial, 'coach-1', ['ILCA 7', 'IQFOIL']);
  assert.deepEqual(next[0].sailingClasses, ['ILCA 7', 'IQFOIL']);
  assert.deepEqual(initial[0].sailingClasses, ['ILCA 7', 'ILCA 6', 'ILCA 4']);
  assert.deepEqual(next[1], initial[1]);
  assert.deepEqual(classesForDemoView('coach-1', next), ['ILCA 7', 'IQFOIL']);
  assert.equal(classesForDemoView(FEDERATION_VIEW, next), null);
});

test('Atribuições repetidas, inválidas ou a treinador inexistente são recusadas', () => {
  const coaches = initialDemoCoaches();
  assert.throws(() => assignDemoCoachClasses(coaches, 'coach-1', ['ILCA 7', 'ILCA 7']), /inválidos/);
  assert.throws(() => assignDemoCoachClasses(coaches, 'coach-1', ['DESCONHECIDA']), /inválidos/);
  assert.throws(() => assignDemoCoachClasses(coaches, 'nao-existe', ['ILCA 7']), /não encontrado/);
});

test('Permite múltiplos treinadores numa classe, sem transformar filtros em login real', () => {
  const initial = initialDemoCoaches();
  const next = assignDemoCoachClasses(initial, 'coach-2', ['ILCA 7', '49er']);
  assert.ok(classesForDemoView('coach-1', next)?.includes('ILCA 7'));
  assert.ok(classesForDemoView('coach-2', next)?.includes('ILCA 7'));
  assert.equal(demoCoachNameForClass(next, 'ILCA 7'), next[0].name);
});

test('Novo treinador fictício começa sem acesso a classes e pode receber atribuições', () => {
  const coaches = appendFictitiousCoach(initialDemoCoaches());
  const created = coaches[coaches.length - 1];
  assert.match(created.name, /exemplo/);
  assert.deepEqual(created.sailingClasses, []);
  assert.deepEqual(classesForDemoView(created.id, coaches), []);
  const updated = assignDemoCoachClasses(coaches, created.id, ['420']);
  assert.deepEqual(classesForDemoView(created.id, updated), ['420']);
});

test('Exportação por vista usa apenas classes filtradas e não altera as folhas do Excel', () => {
  const coaches = initialDemoCoaches();
  const activity = (id: string, sailingClass: string): DemoActivity => ({
    id, title: 'Estágio fictício', sailingClass, type: 'CAMP',
    status: 'PLANNED', start: '2026-11-17', end: '2026-11-19',
    location: 'Local de exemplo', coach: 'Treinador de exemplo',
    expectedAthletes: 3, participants: ['Atleta fictício'],
  });
  const records = [activity('1', 'ILCA 7'), activity('2', '49er')];
  const coachScope = activitiesForDemoView(records, 'coach-1', coaches);
  assert.equal(coachScope.length, 1);
  const book = new ExcelJS.Workbook();
  const map = addClassMap(book, coachScope, 2026, 10);
  book.addWorksheet('Atividades');
  book.addWorksheet('Calendário 11');
  assert.deepEqual(book.worksheets.map((ws) => ws.name),
    ['Mapa Classes 11', 'Atividades', 'Calendário 11']);
  assert.equal(map.getCell('B7').value, 3);
  // A classe 49er não está incluída nesta vista, mas continua no mapa como linha estrutural vazia.
  const rows = Array.from({ length: map.rowCount }, (_, i) => i + 1);
  const fortyNiner = rows.find((row) => map.getCell(row, 1).value === '49er');
  assert.ok(fortyNiner);
  assert.equal(map.getCell(fortyNiner, 2).value, 0);
  assert.equal(map.getCell('AK7').value, 'Estágio fictício');
  assert.match(String(map.getCell('AI4').value), /1 provas\/estágios/);
});
