import assert from 'node:assert/strict';
import test from 'node:test';
import type { DemoActivity } from '../src/demo';
import { activitiesInPeriod, periodFromMonth } from '../src/calendarPeriod';

const activity = (id: string, start: string, end: string, type: DemoActivity['type'] = 'CAMP'): DemoActivity => ({
  id, title: 'Exemplo', sailingClass: 'ILCA 7', type, status: 'PLANNED',
  start, end, location: 'Fictício', coach: 'Treinador fictício',
  expectedAthletes: 2, participants: [],
});

test('Ao mudar de outubro para novembro, os totais utilizam apenas o mês visível', () => {
  const items = [
    activity('oct', '2026-10-03', '2026-10-09'),
    activity('nov', '2026-11-04', '2026-11-10'),
    activity('both', '2026-10-30', '2026-11-03', 'COMPETITION'),
  ];
  assert.deepEqual(activitiesInPeriod(items, {start:'2026-10-01',endExclusive:'2026-11-01'}).map(a=>a.id), ['oct','both']);
  assert.deepEqual(activitiesInPeriod(items, {start:'2026-11-01',endExclusive:'2026-12-01'}).map(a=>a.id), ['nov','both']);
  assert.deepEqual(activitiesInPeriod(items, {start:'2027-01-01',endExclusive:'2027-02-01'}), []);
});

test('Vista anual usa o ano civil, não o mês nem a margem do calendário', () => {
  const items = [
    activity('2026', '2026-10-01', '2026-10-05'),
    activity('newyear', '2026-12-30', '2027-01-03'),
    activity('2027', '2027-04-01', '2027-04-04'),
  ];
  assert.deepEqual(activitiesInPeriod(items, {start:'2026-01-01',endExclusive:'2027-01-01'}).map(a=>a.id), ['2026','newyear']);
  assert.deepEqual(activitiesInPeriod(items, {start:'2027-01-01',endExclusive:'2028-01-01'}).map(a=>a.id), ['newyear','2027']);
});

test('Limites exatos do mês: início incluído e fim exclusivo da janela', () => {
  const items = [
    activity('old','2026-09-20','2026-09-30'),
    activity('start','2026-10-01','2026-10-01'),
    activity('end','2026-10-31','2026-10-31'),
    activity('future','2026-11-01','2026-11-04'),
  ];
  assert.deepEqual(activitiesInPeriod(items, periodFromMonth(new Date(2026,9,15))).map(a=>a.id), ['start','end']);
});
