import { BadRequestException } from '@nestjs/common';
import { ActivityType } from '@prisma/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const DATE = /^20\d{2}-\d{2}-\d{2}$/;
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

export function civilDate(value: unknown): Date {
  if (typeof value !== 'string' || !DATE.test(value)) throw new BadRequestException('Data inválida.');
  const result = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(result.valueOf()) || result.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Data impossível.');
  }
  return result;
}

function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new BadRequestException('Espera-se um objeto JSON.');
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !allowed.includes(key))) {
    throw new BadRequestException('O pedido contém campos não autorizados.');
  }
  return body;
}
function string(value: unknown, max: number, required: boolean): string | null {
  if (value === null && !required) return null;
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) {
    throw new BadRequestException('Texto inválido.');
  }
  return value.trim();
}
function athletes(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 200) {
    throw new BadRequestException('Número de atletas inválido.');
  }
  return value;
}
function type(value: unknown): ActivityType {
  if (typeof value !== 'string' || !Object.values(ActivityType).includes(value as ActivityType)) {
    throw new BadRequestException('Tipo de atividade inválido.');
  }
  return value as ActivityType;
}
function version(value: unknown): Date {
  if (typeof value !== 'string') throw new BadRequestException('Indica expectedUpdatedAt.');
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== value) {
    throw new BadRequestException('Versão da atividade inválida.');
  }
  return date;
}
export function assertDates(start: Date, end: Date): void {
  if (end < start) throw new BadRequestException('A data de fim precede o início.');
}
export function queryPeriod(from: unknown, to: unknown) {
  const start = civilDate(from), end = civilDate(to);
  assertDates(start, end);
  if (end.getTime() - start.getTime() > 366 * 86400000) {
    throw new BadRequestException('Intervalo demasiado longo.');
  }
  return { start, end };
}
export function createInput(value: unknown) {
  const b = object(value, ['title','type','sailingClassId','leadCoachId',
    'startDate','endDate','location','expectedAthleteCount']);
  if (!isUuid(b.sailingClassId) || (b.leadCoachId !== undefined && !isUuid(b.leadCoachId))) {
    throw new BadRequestException('Identificador inválido.');
  }
  const startDate = civilDate(b.startDate), endDate = civilDate(b.endDate);
  assertDates(startDate, endDate);
  return {
    title: string(b.title, 200, true) as string,
    type: type(b.type), sailingClassId: b.sailingClassId,
    leadCoachId: b.leadCoachId as string | undefined,
    startDate, endDate,
    location: b.location === undefined ? null : string(b.location, 200, false),
    expectedAthleteCount: b.expectedAthleteCount === undefined ? null : athletes(b.expectedAthleteCount),
  };
}
export function patchInput(value: unknown) {
  const b = object(value, ['expectedUpdatedAt','title','type','startDate',
    'endDate','location','expectedAthleteCount','status']);
  if (Object.keys(b).length < 2) throw new BadRequestException('Indica uma alteração.');
  if (b.status !== undefined && b.status !== 'PLANNED' && b.status !== 'CANCELLED') {
    throw new BadRequestException('Estado inválido.');
  }
  return {
    expectedUpdatedAt: version(b.expectedUpdatedAt),
    title: b.title === undefined ? undefined : string(b.title, 200, true) as string,
    type: b.type === undefined ? undefined : type(b.type),
    startDate: b.startDate === undefined ? undefined : civilDate(b.startDate),
    endDate: b.endDate === undefined ? undefined : civilDate(b.endDate),
    location: b.location === undefined ? undefined : string(b.location, 200, false),
    expectedAthleteCount: b.expectedAthleteCount === undefined ? undefined : athletes(b.expectedAthleteCount),
    status: b.status as 'PLANNED' | 'CANCELLED' | undefined,
  };
}
export function monthlyInput(value: unknown) {
  const b = object(value, ['expectedUpdatedAt','startDate','endDate']);
  const startDate = civilDate(b.startDate), endDate = civilDate(b.endDate);
  assertDates(startDate, endDate);
  return { expectedUpdatedAt: version(b.expectedUpdatedAt), startDate, endDate };
}
