import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthProfile } from '../auth/auth.service';
import { hashPassword } from '../auth/password';
import { PrismaService } from '../prisma.service';
import {
  parseAccountStatus, parseClassAssignment, parseCreateAccount,
  parseCreateClass, requireId,
} from './admin.input';

const accountSelect = {
  id: true, fullName: true, email: true, role: true, active: true,
  authzVersion: true, createdAt: true,
  coachClasses: {
    select: { sailingClass: { select: { id: true, code: true, name: true } } },
  },
} as const;

function assertAdmin(actor: AuthProfile): void {
  if (actor.role !== 'ADMIN') throw new ForbiddenException('Operação exclusiva de administrador.');
}

function accountPublic(account: {
  id: string; fullName: string; email: string; role: string;
  active: boolean; authzVersion: number; createdAt: Date;
  coachClasses: { sailingClass: { id: string; code: string; name: string } }[];
}) {
  return {
    id: account.id, fullName: account.fullName, email: account.email,
    role: account.role, active: account.active, authzVersion: account.authzVersion,
    createdAt: account.createdAt,
    classes: account.coachClasses.map(item => item.sailingClass),
  };
}

@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}

  async listAccounts(actor: AuthProfile) {
    assertAdmin(actor);
    const items = await this.db.user.findMany({
      select: accountSelect, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], take: 301,
    });
    return { items: items.slice(0, 300).map(accountPublic), truncated: items.length > 300 };
  }

  async listClasses(actor: AuthProfile) {
    assertAdmin(actor);
    return { items: await this.db.sailingClass.findMany({
      select: { id: true, code: true, name: true, active: true },
      orderBy: [{ code: 'asc' }],
    }) };
  }

  async createClass(actor: AuthProfile, body: unknown) {
    assertAdmin(actor);
    const input = parseCreateClass(body);
    try {
      return await this.db.$transaction(async tx => {
        const sailingClass = await tx.sailingClass.create({ data: input });
        await tx.adminChange.create({
          data: {
            actorId: actor.id, action: 'class.create', targetId: sailingClass.id,
            after: { code: sailingClass.code, name: sailingClass.name },
          },
        });
        return sailingClass;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe uma classe com este código.');
      }
      throw error;
    }
  }

  async createAccount(actor: AuthProfile, body: unknown) {
    assertAdmin(actor);
    const { initialPassword, ...input } = parseCreateAccount(body);
    const passwordHash = await hashPassword(initialPassword);
    try {
      return await this.db.$transaction(async tx => {
        const user = await tx.user.create({ data: { ...input, passwordHash } });
        await tx.adminChange.create({
          data: {
            actorId: actor.id, action: 'user.create', targetId: user.id,
            after: { email: user.email, role: user.role, active: user.active },
          },
        });
        const record = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: accountSelect });
        return accountPublic(record);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Este email já está associado a outra conta.');
      }
      throw error;
    }
  }

  async assignClasses(actor: AuthProfile, targetId: string, body: unknown) {
    assertAdmin(actor);
    const id = requireId(targetId);
    const { classIds, expectedVersion } = parseClassAssignment(body);
    return this.db.$transaction(async tx => {
      const target = await tx.user.findUnique({
        where: { id },
        include: { coachClasses: true },
      });
      if (!target || target.role !== 'COACH') {
        throw new NotFoundException('Treinador não encontrado.');
      }
      if (classIds.length) {
        const active = await tx.sailingClass.count({
          where: { id: { in: classIds }, active: true },
        });
        if (active !== classIds.length) {
          throw new BadRequestException('Uma ou mais classes são inexistentes ou inativas.');
        }
      }
      const updated = await tx.user.updateMany({
        where: { id, authzVersion: expectedVersion },
        data: { authzVersion: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException('As atribuições foram alteradas entretanto; atualiza a lista.');
      }
      await tx.coachClass.deleteMany({ where: { userId: id } });
      if (classIds.length) {
        await tx.coachClass.createMany({
          data: classIds.map(sailingClassId => ({ userId: id, sailingClassId })),
        });
      }
      await tx.adminChange.create({
        data: {
          actorId: actor.id, action: 'user.classes', targetId: id,
          before: { classIds: target.coachClasses.map(row => row.sailingClassId) },
          after: { classIds },
        },
      });
      const account = await tx.user.findUniqueOrThrow({ where: { id }, select: accountSelect });
      return accountPublic(account);
    });
  }

  async updateAccountStatus(actor: AuthProfile, targetId: string, body: unknown) {
    assertAdmin(actor);
    const id = requireId(targetId);
    const { active, expectedVersion } = parseAccountStatus(body);
    if (id === actor.id) throw new ForbiddenException('Não podes desativar a tua própria conta.');
    return this.db.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id } });
      if (!target || target.role === 'ADMIN') {
        throw new NotFoundException('Conta gerível não encontrada.');
      }
      const changed = await tx.user.updateMany({
        where: { id, authzVersion: expectedVersion },
        data: { active, authzVersion: { increment: 1 } },
      });
      if (changed.count !== 1) {
        throw new ConflictException('A conta foi alterada entretanto; atualiza a lista.');
      }
      if (!active) {
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.adminChange.create({
        data: {
          actorId: actor.id, action: 'user.status', targetId: id,
          before: { active: target.active }, after: { active },
        },
      });
      const account = await tx.user.findUniqueOrThrow({ where: { id }, select: accountSelect });
      return accountPublic(account);
    });
  }
}
