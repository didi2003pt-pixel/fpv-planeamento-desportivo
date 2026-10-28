import { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth/password';

/**
 * CLI privada, executada manualmente no servidor. Não existe endpoint HTTP
 * de registo nem credenciais incluídas no repositório.
 */
async function main(): Promise<void> {
  if (process.env.FPV_LOCAL_BOOTSTRAP !== '1') {
    throw new Error('Bootstrap desativado. Define FPV_LOCAL_BOOTSTRAP=1 apenas no provisionamento.');
  }
  const email = (process.env.FPV_INITIAL_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.FPV_INITIAL_ADMIN_PASSWORD ?? '';
  const fullName = (process.env.FPV_INITIAL_ADMIN_NAME ?? 'Administrador FPV').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255
    || fullName.length === 0 || fullName.length > 160) {
    throw new Error('Email ou nome de administrador inválido.');
  }
  const passwordHash = await hashPassword(password);
  const db = new PrismaClient();
  try {
    if (await db.user.count({ where: { role: 'ADMIN' } }) > 0) {
      throw new Error('Já existe um administrador. Operação recusada.');
    }
    await db.user.create({ data: { email, fullName, passwordHash, role: 'ADMIN' } });
    console.log('Primeiro administrador criado. Não foram impressas credenciais.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Bootstrap interrompido:', error instanceof Error ? error.message : 'erro desconhecido');
  process.exitCode = 1;
});
