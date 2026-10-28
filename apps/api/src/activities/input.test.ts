import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadClass, canWriteClass } from './access';
import { civilDate, createInput, monthlyInput, patchInput, queryPeriod } from './input';
import type { AuthProfile } from '../auth/auth.service';

const a='00000000-0000-4000-8000-000000000001';
const b='00000000-0000-4000-8000-000000000002';
function profile(role: string): AuthProfile {
  return { id:a, fullName:'Treinador fictício', email:'t@fpv.invalid', role,
    sailingClasses: [{id:a,code:'ILCA 7',name:'ILCA 7'}] };
}
const base={title:'Estágio fictício',type:'CAMP',sailingClassId:a,
  startDate:'2027-01-17',endDate:'2027-01-31'};

test('treinadores só consultam e editam as suas classes',()=>{
  assert.equal(canReadClass(profile('COACH'),a),true);
  assert.equal(canWriteClass(profile('COACH'),b),false);
  assert.equal(canReadClass(profile('COACH'),b),false);
  assert.equal(canWriteClass(profile('VIEWER'),a),false);
  assert.equal(canReadClass(profile('VIEWER'),b),true);
  assert.equal(canWriteClass(profile('COORDINATOR'),b),true);
  assert.equal(canReadClass(profile('INVALID'),a),false);
});
test('validação bloqueia datas inexistentes, intervalos e números impossíveis',()=>{
  assert.throws(()=>civilDate('2027-02-29'));
  assert.throws(()=>civilDate('2026-11-31'));
  assert.throws(()=>createInput({...base,endDate:'2027-01-16'}));
  assert.throws(()=>queryPeriod('2026-01-01','2028-01-01'));
  assert.throws(()=>createInput({...base,expectedAthleteCount:201}));
  assert.equal(createInput(base).endDate.toISOString().slice(0,10),'2027-01-31');
});
test('PATCH não admite troca de classe, de treinador ou alteração da auditoria',()=>{
  assert.throws(()=>patchInput({expectedUpdatedAt:'2026-10-28T00:00:00.000Z',sailingClassId:b}));
  assert.throws(()=>patchInput({expectedUpdatedAt:'2026-10-28T00:00:00.000Z',leadCoachId:b}));
  assert.throws(()=>patchInput({expectedUpdatedAt:'2026-10-28T00:00:00.000Z',status:'CONFIRMED'}));
  assert.throws(()=>patchInput({expectedUpdatedAt:'2026-10-28T00:00:00.000Z'}));
  assert.doesNotThrow(()=>patchInput({expectedUpdatedAt:'2026-10-28T00:00:00.000Z',location:'Faro'}));
});
test('confirmação mensal só aceita duas datas civis e versão do registo',()=>{
  assert.equal(monthlyInput({expectedUpdatedAt:'2026-10-28T00:00:00.000Z',
    startDate:'2027-01-17',endDate:'2027-01-27'}).endDate.toISOString().slice(0,10),'2027-01-27');
  assert.throws(()=>monthlyInput({startDate:'2027-01-17',endDate:'2027-01-27'}));
  assert.throws(()=>monthlyInput({expectedUpdatedAt:'2026-10-28T00:00:00.000Z',
    startDate:'2027-01-28',endDate:'2027-01-27'}));
});
