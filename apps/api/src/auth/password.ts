import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
const COST = 16384;
const BLOCK = 8;
const PARALLEL = 1;
const SALT_SIZE = 16;
const KEY_SIZE = 64;
const OPTIONS = { N: COST, r: BLOCK, p: PARALLEL, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_SIZE, OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 14 || password.length > 128) {
    throw new Error('A password deve ter entre 14 e 128 caracteres.');
  }
  const salt = randomBytes(SALT_SIZE);
  const key = await derive(password, salt);
  return ['scrypt', COST, BLOCK, PARALLEL, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt'
    || Number(parts[1]) !== COST || Number(parts[2]) !== BLOCK
    || Number(parts[3]) !== PARALLEL || password.length > 128) return false;
  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length !== SALT_SIZE || expected.length !== KEY_SIZE) return false;
    const computed = await derive(password, salt);
    return timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}
