import assert from 'node:assert/strict';
import test from 'node:test';
import { api, ApiError, errorText, newActivityPayload } from '../src/private/api';

test('Mensagens HTTP não expõem detalhes internos do servidor', () => {
  assert.match(errorText(401), /sessão/i);
  assert.match(errorText(403), /permissões/);
  assert.match(errorText(409), /dados mudaram/i);
  assert.doesNotMatch(errorText(500), /password|stack|postgres/i);
});

test('Pedidos usam cookies same-origin e nunca copiam token para armazenamento', async () => {
  const before = globalThis.fetch;
  let captured: { url: unknown; options: RequestInit } | null = null;
  globalThis.fetch = async (input, options) => {
    captured = { url: input, options: options ?? {} };
    return new Response(JSON.stringify({ user: { id: 'test' } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const result = await api<{ user: { id: string } }>('/auth/me');
    assert.equal(result.user.id, 'test');
    assert.ok(captured);
    assert.equal(captured.url, '/api/auth/me');
    assert.equal(captured.options.credentials, 'same-origin');
    assert.equal(captured.options.cache, 'no-store');
    assert.equal(captured.options.headers, undefined);
  } finally { globalThis.fetch = before; }
});

test('Erros de autenticação mantêm o código HTTP esperado', async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  try {
    await assert.rejects(api('/auth/me'), (reason: unknown) =>
      reason instanceof ApiError && reason.status === 401);
  } finally { globalThis.fetch = before; }
});

test('Registo do treinador preserva as datas anuais e não permite escolher outro responsável', () => {
  const payload = newActivityPayload({
    title: '  Estágio ILCA 7  ', sailingClassId: 'classe-de-teste',
    type: 'CAMP', startDate: '2027-01-17', endDate: '2027-01-31',
    location: '  Vilamoura  ', expectedAthleteCount: 3,
  });
  assert.deepEqual(payload, {
    title: 'Estágio ILCA 7', sailingClassId: 'classe-de-teste',
    type: 'CAMP', startDate: '2027-01-17', endDate: '2027-01-31',
    location: 'Vilamoura', expectedAthleteCount: 3,
  });
  assert.equal('leadCoachId' in payload, false);
});

test('Registo rejeita intervalos inválidos e números de atletas inconsistentes', () => {
  const draft = {
    title: 'Estágio', sailingClassId: 'classe',
    type: 'CAMP' as const, startDate: '2027-01-17', endDate: '2027-01-27',
    location: '', expectedAthleteCount: 3,
  };
  assert.throws(() => newActivityPayload({ ...draft, endDate: '2027-01-16' }), /datas/);
  assert.throws(() => newActivityPayload({ ...draft, startDate: '2027-02-30' }), /datas/);
  assert.throws(() => newActivityPayload({ ...draft, expectedAthleteCount: -1 }), /atletas/);
  assert.throws(() => newActivityPayload({ ...draft, sailingClassId: '' }), /classe/);
});

test('Criar uma atividade usa apenas a API privada autenticada por cookie', async () => {
  const before = globalThis.fetch;
  let captured: { url: unknown; options: RequestInit } | null = null;
  globalThis.fetch = async (input, options) => {
    captured = { url: input, options: options ?? {} };
    return new Response(JSON.stringify({ id: 'atividade-teste' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const payload = newActivityPayload({
      title: 'Regata', sailingClassId: 'classe', type: 'COMPETITION',
      startDate: '2027-04-03', endDate: '2027-04-05',
      location: 'Cascais', expectedAthleteCount: 4,
    });
    const result = await api<{ id: string }>('/activities', 'POST', payload);
    assert.equal(result.id, 'atividade-teste');
    assert.ok(captured);
    assert.equal(captured.url, '/api/activities');
    assert.equal(captured.options.method, 'POST');
    assert.equal(captured.options.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(captured.options.body)), payload);
  } finally { globalThis.fetch = before; }
});
