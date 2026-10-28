import assert from 'node:assert/strict';
import test from 'node:test';
import { api, ApiError, errorText } from '../src/private/api';

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
