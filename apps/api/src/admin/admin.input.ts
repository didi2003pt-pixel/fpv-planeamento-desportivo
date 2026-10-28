import { BadRequestException } from '@nestjs/common';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = ['COACH', 'COORDINATOR', 'VIEWER'] as const;
type ManagedRole = typeof roles[number];

export function requireId(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new BadRequestException('Identificador inválido.');
  }
  return value;
}

function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new BadRequestException('Esperava-se um objeto JSON.');
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !allowed.includes(key))) {
    throw new BadRequestException('Campos não permitidos.');
  }
  return input;
}

function name(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max
    || /[\u0000-\u001f]/.test(value)) {
    throw new BadRequestException('Nome ou código inválido.');
  }
  return value.trim();
}

function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new BadRequestException('expectedVersion deve ser um inteiro não negativo.');
  }
  return value;
}

export function parseCreateAccount(value: unknown): {
  fullName: string; email: string; initialPassword: string; role: ManagedRole;
} {
  const input = object(value, ['fullName', 'email', 'initialPassword', 'role']);
  const fullName = name(input.fullName, 160);
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new BadRequestException('Email inválido.');
  }
  if (typeof input.initialPassword !== 'string'
    || input.initialPassword.length < 14 || input.initialPassword.length > 128) {
    throw new BadRequestException('Password inicial: entre 14 e 128 caracteres.');
  }
  if (!roles.includes(input.role as ManagedRole)) {
    throw new BadRequestException('Role inválida; ADMIN não pode ser criada por esta rota.');
  }
  return { fullName, email, initialPassword: input.initialPassword, role: input.role as ManagedRole };
}

export function parseCreateClass(value: unknown): { code: string; name: string } {
  const input = object(value, ['code', 'name']);
  return { code: name(input.code, 40), name: name(input.name, 120) };
}

export function parseClassAssignment(value: unknown): {
  classIds: string[]; expectedVersion: number;
} {
  const input = object(value, ['classIds', 'expectedVersion']);
  if (!Array.isArray(input.classIds) || input.classIds.length > 40) {
    throw new BadRequestException('A lista deve ter até 40 classes.');
  }
  const classIds = input.classIds.map(requireId);
  if (new Set(classIds).size !== classIds.length) {
    throw new BadRequestException('Não são permitidas classes repetidas.');
  }
  return { classIds, expectedVersion: revision(input.expectedVersion) };
}

export function parseAccountStatus(value: unknown): { active: boolean; expectedVersion: number } {
  const input = object(value, ['active', 'expectedVersion']);
  if (typeof input.active !== 'boolean') {
    throw new BadRequestException('O campo active deve ser booleano.');
  }
  return { active: input.active, expectedVersion: revision(input.expectedVersion) };
}
