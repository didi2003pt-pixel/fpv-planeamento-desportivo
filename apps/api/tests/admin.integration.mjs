import assert from 'node:assert/strict';

const base = process.env.FPV_TEST_BASE_URL ?? 'http://localhost:8080';
const initial = 'TesteSomenteNoCI_2026#Fortissima';
const another = 'ContaFicticiaSegura#2026';
const ilca = '10000000-0000-4000-8000-000000000001';

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
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function login(email, password) {
  const response = await request('/auth/login', {
    method: 'POST', data: { email, password },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.cookie?.startsWith('fpv_session='));
  return response.cookie;
}
async function main() {
  const [admin, coachA] = await Promise.all([
    login('admin@fpv.invalid', initial), login('coach-a@fpv.invalid', initial),
  ]);
  assert.equal((await request('/admin/users')).status, 401);
  assert.equal((await request('/admin/users', {cookie:coachA})).status, 403);
  assert.equal((await request('/admin/classes', {cookie:coachA})).status, 403);
  assert.equal((await request('/admin/users', {method:'POST',cookie:coachA,data:{
    fullName:'Outro',email:'outro@fpv.invalid',role:'COACH',initialPassword:another,
  }})).status,403);

  const cls=await request('/admin/classes',{method:'POST',cookie:admin,
    data:{code:'420',name:'Classe 420'}});
  assert.equal(cls.status,201,JSON.stringify(cls.body));
  assert.equal(cls.body.code,'420');
  const duplicate=await request('/admin/classes',{method:'POST',cookie:admin,
    data:{code:'420',name:'Classe repetida'}});
  assert.equal(duplicate.status,409);
  assert.ok((await request('/admin/classes',{cookie:admin})).body.items.some(item=>item.id===cls.body.id));

  const adminCreation=await request('/admin/users',{method:'POST',cookie:admin,
    data:{fullName:'Administrador extra',email:'extra@fpv.invalid',
      role:'ADMIN', initialPassword:another}});
  assert.equal(adminCreation.status,400);

  const created=await request('/admin/users',{method:'POST',cookie:admin,
    data:{fullName:'Treinador exemplo',email:'novo-treinador@fpv.invalid',
      role:'COACH',initialPassword:another}});
  assert.equal(created.status,201,JSON.stringify(created.body));
  const id=created.body.id;
  assert.equal(created.body.authzVersion,0);
  assert.deepEqual(created.body.classes,[]);
  assert.equal('passwordHash' in created.body,false);
  assert.equal('initialPassword' in created.body,false);
  const listed=await request('/admin/users',{cookie:admin});
  assert.equal(listed.status,200);
  assert.ok(listed.body.items.some(user=>user.id===id));
  assert.equal(JSON.stringify(listed.body).includes(another),false);
  assert.equal(JSON.stringify(listed.body).includes('passwordHash'),false);

  const newCoach=await login('novo-treinador@fpv.invalid',another);
  assert.deepEqual((await request('/classes',{cookie:newCoach})).body.items,[]);
  assert.equal((await request('/admin/users',{cookie:newCoach})).status,403);

  const assigned=await request('/admin/users/'+id+'/classes',{method:'PUT',cookie:admin,
    data:{classIds:[ilca,cls.body.id],expectedVersion:0}});
  assert.equal(assigned.status,200,JSON.stringify(assigned.body));
  assert.equal(assigned.body.authzVersion,1);
  assert.deepEqual(new Set(assigned.body.classes.map(item=>item.id)),new Set([ilca,cls.body.id]));
  assert.deepEqual(new Set((await request('/classes',{cookie:newCoach})).body.items.map(item=>item.id)),
    new Set([ilca,cls.body.id]));
  const stale=await request('/admin/users/'+id+'/classes',{method:'PUT',cookie:admin,
    data:{classIds:[ilca],expectedVersion:0}});
  assert.equal(stale.status,409);

  const activity=await request('/activities',{method:'POST',cookie:newCoach,
    data:{title:'Estágio da classe 420 - fictício',type:'CAMP',sailingClassId:cls.body.id,
      startDate:'2027-03-10',endDate:'2027-03-14',location:'Faro'}});
  assert.equal(activity.status,201,JSON.stringify(activity.body));

  const removed=await request('/admin/users/'+id+'/classes',{method:'PUT',cookie:admin,
    data:{classIds:[ilca],expectedVersion:1}});
  assert.equal(removed.status,200);
  assert.equal(removed.body.authzVersion,2);
  assert.equal((await request('/activities/'+activity.body.id,{cookie:newCoach})).status,404);
  const list=await request('/activities?from=2027-03-01&to=2027-03-31',{cookie:newCoach});
  assert.equal(list.status,200);
  assert.equal(list.body.items.length,0);
  assert.equal((await request('/activities/'+activity.body.id,{cookie:admin})).status,200);

  const deactivated=await request('/admin/users/'+id+'/status',{method:'PATCH',cookie:admin,
    data:{active:false,expectedVersion:2}});
  assert.equal(deactivated.status,200);
  assert.equal(deactivated.body.active,false);
  assert.equal(deactivated.body.authzVersion,3);
  assert.equal((await request('/auth/me',{cookie:newCoach})).status,401);
  assert.equal((await request('/auth/login',{method:'POST',
    data:{email:'novo-treinador@fpv.invalid',password:another}})).status,401);
  assert.equal((await request('/admin/users/'+id+'/status',{method:'PATCH',cookie:coachA,
    data:{active:true,expectedVersion:3}})).status,403);

  const restored=await request('/admin/users/'+id+'/status',{method:'PATCH',cookie:admin,
    data:{active:true,expectedVersion:3}});
  assert.equal(restored.status,200);
  assert.equal(restored.body.authzVersion,4);
  assert.equal((await request('/auth/me',{cookie:newCoach})).status,401);
  const fresh=await login('novo-treinador@fpv.invalid',another);
  assert.equal((await request('/auth/me',{cookie:fresh})).status,200);

  const ownStatus=await request('/admin/users/'+(await request('/auth/me',{cookie:admin})).body.user.id+'/status',
    {method:'PATCH',cookie:admin,data:{active:false,expectedVersion:0}});
  assert.equal(ownStatus.status,403);

  const audit=await request('/admin/users',{cookie:admin});
  assert.ok(audit.body.items.find(item=>item.id===id)?.authzVersion===4);
  console.log('Admin FPV: contas, classes, versões, revogação de sessões, isolamento de treinadores — OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
