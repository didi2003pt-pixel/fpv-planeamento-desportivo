import test from 'node:test';
import assert from 'node:assert/strict';
import type { DemoActivity } from '../src/demo';
import { annualPlanDates, confirmMonthlyPlan, monthlyDatesDiffer } from '../src/monthlyPlan';
import { countClassDays } from '../src/exportClassMap';
import { activityToDraft, createDemoActivity, editDemoActivity } from '../src/activityDraft';

const stage: DemoActivity = {
  id: 'demo-monthly-01', title: 'Estágio fictício', sailingClass: 'ILCA 7',
  type: 'CAMP', status: 'PLANNED',
  start: '2027-01-17', end: '2027-01-31',
  annualStart: '2027-01-17', annualEnd: '2027-01-31', monthlyConfirmed: false,
  location: 'Vilamoura', coach: 'Treinador fictício',
  expectedAthletes: 3, participants: ['Atleta 01'],
};

test('Estágio de 17–31 pode ser confirmado apenas de 17–27 sem perder plano anual', () => {
  const updated = confirmMonthlyPlan(stage, '2027-01-17', '2027-01-27');
  assert.deepEqual(annualPlanDates(updated), {start:'2027-01-17',end:'2027-01-31'});
  assert.equal(updated.start,'2027-01-17');
  assert.equal(updated.end,'2027-01-27');
  assert.equal(updated.monthlyConfirmed,true);
  assert.equal(updated.status,'CONFIRMED');
  assert.equal(monthlyDatesDiffer(updated),true);
  assert.equal(countClassDays([stage],2027,0),15);
  assert.equal(countClassDays([updated],2027,0),11);
  assert.equal(stage.monthlyConfirmed,false);
  assert.equal(stage.end,'2027-01-31');
});

test('Rever confirmação mensal mantém previsão anual original', () => {
  const first = confirmMonthlyPlan(stage,'2027-01-17','2027-01-27');
  const second = confirmMonthlyPlan(first,'2027-01-18','2027-01-25');
  assert.deepEqual(annualPlanDates(second), annualPlanDates(stage));
  assert.equal(second.start,'2027-01-18');
  assert.equal(second.end,'2027-01-25');
  assert.equal(second.id,stage.id);
  assert.equal(second.coach,stage.coach);
  assert.deepEqual(second.participants,stage.participants);
});

test('Confirmação sem alterações de datas fica distinguida de alteração efetiva', () => {
  const updated = confirmMonthlyPlan(stage,stage.start,stage.end);
  assert.equal(updated.monthlyConfirmed,true);
  assert.equal(monthlyDatesDiffer(updated),false);
  assert.equal(monthlyDatesDiffer(stage),false);
});

test('Impedir datas inválidas, invertidas, atividade cancelada ou realizada', () => {
  assert.throws(()=>confirmMonthlyPlan(stage,'2027-02-29','2027-03-01'),/datas válidas/);
  assert.throws(()=>confirmMonthlyPlan(stage,'2027-01-28','2027-01-17'),/fim/);
  assert.throws(()=>confirmMonthlyPlan({...stage,status:'CANCELLED'},stage.start,stage.end),/canceladas/);
  assert.throws(()=>confirmMonthlyPlan({...stage,status:'COMPLETED'},stage.start,stage.end),/realizadas/);
});

test('Edição posterior não destrói datas anuais originais', () => {
  const updated = confirmMonthlyPlan(stage,'2027-01-17','2027-01-27');
  const changed = editDemoActivity(updated,{
    ...activityToDraft(updated),
    location: 'Cascais', expectedAthletes: 4,
  });
  assert.equal(changed.annualEnd,'2027-01-31');
  assert.equal(changed.end,'2027-01-27');
  assert.equal(changed.monthlyConfirmed,true);
  assert.equal(changed.location,'Cascais');
});

test('Novas atividades de demonstração têm previsão anual inicial', () => {
  const original = createDemoActivity({
    title:'Regata fictícia', sailingClass:'ILCA 6', type:'COMPETITION',
    status:'PLANNED',start:'2027-02-01',end:'2027-02-04',
    location:'França',expectedAthletes:2,participantLines:'',
  },'demo-new');
  assert.deepEqual(annualPlanDates(original),{start:'2027-02-01',end:'2027-02-04'});
  assert.equal(original.monthlyConfirmed,false);
});
