import assert from 'node:assert/strict';

const base = process.env.FPV_TEST_BASE_URL ?? 'http://localhost:8080';
const password = 'TesteSomenteNoCI_2026#Fortissima';
const one = '10000000-0000-4000-8000-000000000001';
const two = '10000000-0000-4000-8000-000000000002';

async function request(path, { method = 'GET', cookie, data } = {}) {
  const response = await fetch(base + '/api' + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function login(email) {
  const result = await request('/auth/login', { method: 'POST',
    data: { email, password } });
  assert.equal(result.status, 200, email + ': não iniciou sessão');
  assert.ok(result.cookie?.startsWith('fpv_session='), 'cookie de sessão ausente');
  return result.cookie;
}
async function main() {
  assert.equal((await request('/activities?from=2027-01-01&to=2027-12-31')).status, 401);
  const [admin, a, b, viewer] = await Promise.all([
    login('admin@fpv.invalid'), login('coach-a@fpv.invalid'),
    login('coach-b@fpv.invalid'), login('viewer@fpv.invalid'),
  ]);
  const classesA = await request('/classes', {cookie:a});
  assert.equal(classesA.status, 200);
  assert.deepEqual(classesA.body.items.map(item => item.id), [one]);
  assert.deepEqual((await request('/classes', {cookie:b})).body.items.map(item => item.id), [two]);
  const deniedCreate = await request('/activities', {method:'POST', cookie:a,
    data:{title:'Prova fictícia',type:'COMPETITION',sailingClassId:two,
      startDate:'2027-01-17',endDate:'2027-01-27'}});
  assert.equal(deniedCreate.status,403);
  const deniedLead = await request('/activities', {method:'POST', cookie:a,
    data:{title:'Prova fictícia',type:'COMPETITION',sailingClassId:one,
      leadCoachId:'20000000-0000-4000-8000-000000000002',
      startDate:'2027-01-17',endDate:'2027-01-27'}});
  assert.equal(deniedLead.status,403);

  const created = await request('/activities', {method:'POST',cookie:a,
    data:{title:'Estágio ILCA 7 (fictício)',type:'CAMP',sailingClassId:one,
      startDate:'2027-01-17',endDate:'2027-01-31',location:'Vilamoura',expectedAthleteCount:3}});
  assert.equal(created.status,201, JSON.stringify(created.body));
  const id = created.body.id;
  assert.ok(id);
  assert.equal(created.body.annualEndDate.slice(0,10),'2027-01-31');
  assert.equal(created.body.monthlyConfirmed,false);

  assert.equal((await request('/activities/' + id, {cookie:b})).status,404);
  assert.equal((await request('/activities/' + id, {cookie:admin})).status,200);
  assert.equal((await request('/activities/' + id, {cookie:viewer})).status,200);
  const listA=await request('/activities?from=2027-01-01&to=2027-12-31',{cookie:a});
  assert.equal(listA.status,200);
  assert.deepEqual(listA.body.items.map(item => item.id), [id]);
  assert.equal((await request('/activities?from=2027-01-01&to=2027-12-31',{cookie:b})).body.items.length,0);
  assert.equal((await request('/activities/' + id,{cookie:a})).body.title,'Estágio ILCA 7 (fictício)');

  const patchDenied=await request('/activities/' + id,{method:'PATCH',cookie:b,
    data:{expectedUpdatedAt:created.body.updatedAt, location:'Tentar alterar'}});
  assert.equal(patchDenied.status,404);
  assert.equal((await request('/activities/' + id,{method:'PATCH',cookie:viewer,
    data:{expectedUpdatedAt:created.body.updatedAt,location:'Alteração proibida'}})).status,404);
  assert.equal((await request('/activities/' + id,{method:'PATCH',cookie:a,
    data:{expectedUpdatedAt:created.body.updatedAt,sailingClassId:two}})).status,400);

  const edited=await request('/activities/' + id,{method:'PATCH',cookie:a,
    data:{expectedUpdatedAt:created.body.updatedAt,location:'Lagos'}});
  assert.equal(edited.status,200,JSON.stringify(edited.body));
  assert.equal(edited.body.location,'Lagos');
  const stale=await request('/activities/' + id,{method:'PATCH',cookie:a,
    data:{expectedUpdatedAt:created.body.updatedAt,location:'Versão antiga'}});
  assert.equal(stale.status,409);

  const confirmed=await request('/activities/' + id + '/confirm-monthly',{method:'POST',cookie:a,
    data:{expectedUpdatedAt:edited.body.updatedAt,
      startDate:'2027-01-17',endDate:'2027-01-27'}});
  assert.equal(confirmed.status,201,JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.annualEndDate.slice(0,10),'2027-01-31');
  assert.equal(confirmed.body.endDate.slice(0,10),'2027-01-27');
  assert.equal(confirmed.body.monthlyConfirmed,true);
  assert.equal(confirmed.body.planningStage,'MONTHLY');
  const forbiddenDateEdit=await request('/activities/' + id,{method:'PATCH',cookie:a,
    data:{expectedUpdatedAt:confirmed.body.updatedAt,endDate:'2027-01-25'}});
  assert.equal(forbiddenDateEdit.status,400);

  const badRange=await request('/activities?from=2027-01-01&to=2029-01-01',{cookie:admin});
  assert.equal(badRange.status,400);
  console.log('Integração FPV: 401 anónimo, isolamento de classes, 403 criação, 404 outros treinadores, viewer read-only, auditoria de versões, mês confirmado — OK');
}
main().catch(error => { console.error(error); process.exitCode=1; });
