import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCreateAccount, parseCreateClass,
  parseClassAssignment, parseAccountStatus, requireId,
} from './admin.input';

const a = '00000000-0000-4000-8000-000000000001';
test('contas exigem email, password forte e papel controlado', () => {
  const user = parseCreateAccount({
    fullName:'  Treinador de exemplo ',email:'EXEMPLO@FPV.INVALID',
    initialPassword:'UmaPasswordSegura#2026',role:'COACH',
  });
  assert.equal(user.email,'exemplo@fpv.invalid');
  assert.equal(user.fullName,'Treinador de exemplo');
  assert.throws(() => parseCreateAccount({...user, role:'ADMIN'}));
  assert.throws(() => parseCreateAccount({...user, initialPassword:'1234'}));
  assert.throws(() => parseCreateAccount({...user, passwordHash:'qualquer'}));
});
test('atribuições com classe repetida, inexistente ou versão errada são recusadas', () => {
  assert.deepEqual(parseClassAssignment({classIds:[a], expectedVersion:0}), {
    classIds:[a], expectedVersion:0,
  });
  assert.throws(() => parseClassAssignment({classIds:[a,a], expectedVersion:0}));
  assert.throws(() => parseClassAssignment({classIds:[a], expectedVersion:-1}));
  assert.throws(() => parseClassAssignment({classIds:['000000'], expectedVersion:0}));
  assert.throws(() => requireId('um-id-qualquer'));
});
test('alteração de estado só aceita active e versão', () => {
  assert.deepEqual(parseAccountStatus({active:false,expectedVersion:2}),
    {active:false,expectedVersion:2});
  assert.throws(() => parseAccountStatus({active:'false',expectedVersion:2}));
  assert.throws(() => parseAccountStatus({active:false,expectedVersion:2,role:'ADMIN'}));
});
test('criação de classe bloqueia campos extras e nomes vazios', () => {
  assert.deepEqual(parseCreateClass({code:'420',name:'Classe 420'}),
    {code:'420',name:'Classe 420'});
  assert.throws(() => parseCreateClass({code:' ',name:'Classe'}));
  assert.throws(() => parseCreateClass({code:'420',name:'Classe',active:true}));
});
