import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Activity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { AuthProfile } from '../auth/auth.service';
import { canReadClass, canWriteClass } from './access';
import {
  assertDates, createInput, isUuid, monthlyInput, patchInput, queryPeriod,
} from './input';

const include = {
  sailingClass: { select: { id: true, code: true, name: true } },
  leadCoach: { select: { id: true, fullName: true } },
} as const;

function checkUuid(id: string): void {
  if (!isUuid(id)) throw new BadRequestException('ID da atividade inválido.');
}
function enforceRead(user: AuthProfile, sailingClassId: string): void {
  if (!canReadClass(user, sailingClassId)) throw new NotFoundException('Atividade não encontrada.');
}
function enforceWrite(user: AuthProfile, sailingClassId: string): void {
  if (!canWriteClass(user, sailingClassId)) throw new NotFoundException('Atividade não encontrada.');
}
function snapshot(activity: Activity) {
  return {
    id: activity.id, title: activity.title, type: activity.type,
    status: activity.status, planningStage: activity.planningStage,
    sailingClassId: activity.sailingClassId, leadCoachId: activity.leadCoachId,
    startDate: activity.startDate.toISOString().slice(0, 10),
    endDate: activity.endDate.toISOString().slice(0, 10),
    annualStartDate: activity.annualStartDate?.toISOString().slice(0, 10) ?? null,
    annualEndDate: activity.annualEndDate?.toISOString().slice(0, 10) ?? null,
    monthlyConfirmed: activity.monthlyConfirmed,
    location: activity.location, expectedAthleteCount: activity.expectedAthleteCount,
  };
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly db: PrismaService) {}

  async classes(user: AuthProfile) {
    return this.db.sailingClass.findMany({
      where: {
        active: true,
        ...(user.role === 'COACH'
          ? { id: { in: user.sailingClasses.map(item => item.id) } }
          : user.role === 'ADMIN' || user.role === 'COORDINATOR' || user.role === 'VIEWER'
            ? {} : { id: { in: [] as string[] } }),
      },
      select: { id: true, code: true, name: true }, orderBy: { code: 'asc' },
    });
  }

  async list(user: AuthProfile, from: unknown, to: unknown) {
    const period = queryPeriod(from, to);
    const ids = user.sailingClasses.map(item => item.id);
    const where: Prisma.ActivityWhereInput = {
      startDate: { lte: period.end },
      endDate: { gte: period.start },
      ...(user.role === 'COACH' ? { sailingClassId: { in: ids } }
        : user.role === 'ADMIN' || user.role === 'COORDINATOR' || user.role === 'VIEWER'
          ? {} : { sailingClassId: { in: [] } }),
    };
    const matches = await this.db.activity.findMany({
      where, include, orderBy: [{ startDate: 'asc' }, { id: 'asc' }], take: 501,
    });
    return { items: matches.slice(0, 500), truncated: matches.length > 500 };
  }

  async get(user: AuthProfile, id: string) {
    checkUuid(id);
    const activity = await this.db.activity.findUnique({ where: { id }, include });
    if (!activity) throw new NotFoundException('Atividade não encontrada.');
    enforceRead(user, activity.sailingClassId);
    return activity;
  }

  async create(user: AuthProfile, body: unknown) {
    const input = createInput(body);
    if (!canWriteClass(user, input.sailingClassId)) {
      throw new ForbiddenException('Não tens autorização para esta classe.');
    }
    const sailingClass = await this.db.sailingClass.findFirst({
      where: { id: input.sailingClassId, active: true }, select: { id: true },
    });
    if (!sailingClass) throw new NotFoundException('Classe inativa ou inexistente.');

    let leadCoachId: string;
    if (user.role === 'COACH') {
      if (input.leadCoachId && input.leadCoachId !== user.id) {
        throw new ForbiddenException('Um treinador não pode atribuir atividades a outro treinador.');
      }
      leadCoachId = user.id;
    } else {
      if (!input.leadCoachId) throw new BadRequestException('Indica leadCoachId.');
      leadCoachId = input.leadCoachId;
    }
    const lead = await this.db.user.findFirst({
      where: {
        id: leadCoachId, active: true,
        coachClasses: { some: { sailingClassId: input.sailingClassId } },
      },
      select: { id: true },
    });
    if (!lead) throw new BadRequestException('Treinador não está ativo ou atribuído à classe.');

    return this.db.$transaction(async tx => {
      const activity = await tx.activity.create({
        data: {
          ...input, leadCoachId, createdById: user.id,
          annualStartDate: input.startDate, annualEndDate: input.endDate,
          monthlyConfirmed: false, status: 'PLANNED', planningStage: 'ANNUAL',
        },
      });
      await tx.activityChange.create({
        data: { activityId: activity.id, actorId: user.id, after: snapshot(activity), reason: 'create' },
      });
      return tx.activity.findUniqueOrThrow({ where: { id: activity.id }, include });
    });
  }

  async patch(user: AuthProfile, id: string, body: unknown) {
    checkUuid(id);
    const input = patchInput(body);
    return this.db.$transaction(async tx => {
      const previous = await tx.activity.findUnique({ where: { id } });
      if (!previous) throw new NotFoundException('Atividade não encontrada.');
      enforceWrite(user, previous.sailingClassId);
      if (previous.status === 'COMPLETED') {
        throw new ForbiddenException('Não é possível alterar uma atividade realizada.');
      }
      const { expectedUpdatedAt, ...data } = input;
      const datesEdited = data.startDate !== undefined || data.endDate !== undefined;
      if (datesEdited && previous.monthlyConfirmed) {
        throw new BadRequestException('Revê as datas usando a confirmação mensal.');
      }
      const start = data.startDate ?? previous.startDate;
      const end = data.endDate ?? previous.endDate;
      assertDates(start, end);
      const result = await tx.activity.updateMany({
        where: { id, updatedAt: expectedUpdatedAt },
        data: {
          ...data,
          ...(datesEdited ? { annualStartDate: start, annualEndDate: end } : {}),
        },
      });
      if (result.count !== 1) throw new ConflictException('Atividade alterada entretanto; atualiza o calendário.');
      const changed = await tx.activity.findUniqueOrThrow({ where: { id }, include });
      await tx.activityChange.create({
        data: { activityId: id, actorId: user.id, before: snapshot(previous),
          after: snapshot(changed), reason: 'update' },
      });
      return changed;
    });
  }

  async confirmMonth(user: AuthProfile, id: string, body: unknown) {
    checkUuid(id);
    const input = monthlyInput(body);
    return this.db.$transaction(async tx => {
      const previous = await tx.activity.findUnique({ where: { id } });
      if (!previous) throw new NotFoundException('Atividade não encontrada.');
      enforceWrite(user, previous.sailingClassId);
      if (previous.status === 'CANCELLED' || previous.status === 'COMPLETED') {
        throw new ForbiddenException('Não é possível confirmar atividade cancelada ou realizada.');
      }
      const result = await tx.activity.updateMany({
        where: { id, updatedAt: input.expectedUpdatedAt },
        data: {
          startDate: input.startDate, endDate: input.endDate,
          annualStartDate: previous.annualStartDate ?? previous.startDate,
          annualEndDate: previous.annualEndDate ?? previous.endDate,
          monthlyConfirmed: true, planningStage: 'MONTHLY', status: 'CONFIRMED',
        },
      });
      if (result.count !== 1) throw new ConflictException('Atividade alterada entretanto; atualiza o calendário.');
      const updated = await tx.activity.findUniqueOrThrow({ where: { id }, include });
      await tx.activityChange.create({
        data: { activityId: id, actorId: user.id, before: snapshot(previous),
          after: snapshot(updated), reason: 'confirm-monthly' },
      });
      return updated;
    });
  }
}
