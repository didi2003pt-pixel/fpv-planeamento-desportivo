import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password';
import { hashSessionToken } from './auth.service';

test('password não é guardada em texto simples e corresponde apenas à correta', async () => {
  const encoded = await hashPassword('UmaPasswordForte#Teste2026');
  assert.ok(encoded.startsWith('scrypt$'));
  assert.equal(encoded.includes('UmaPasswordForte#Teste2026'), false);
  assert.equal(await verifyPassword('UmaPasswordForte#Teste2026', encoded), true);
  assert.equal(await verifyPassword('password-errada', encoded), false);
});

test('salt individual: duas passwords idênticas geram hashes diferentes', async () => {
  const a = await hashPassword('UmaPasswordForte#Teste2026');
  const b = await hashPassword('UmaPasswordForte#Teste2026');
  assert.notEqual(a, b);
});

test('não aceita hashes adulterados nem passwords fracas na criação', async () => {
  assert.equal(await verifyPassword('qualquer', 'invalid'), false);
  await assert.rejects(() => hashPassword('1234'), /14/);
});

test('tokens de sessão são guardados apenas como SHA-256', () => {
  assert.equal(hashSessionToken('abc').length, 64);
  assert.notEqual(hashSessionToken('abc'), hashSessionToken('xyz'));
});
