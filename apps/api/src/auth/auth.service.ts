import { Injectable, TooManyRequestsException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { verifyPassword } from './password';

export const SESSION_COOKIE = 'fpv_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function hashSessionToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export type AuthProfile = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  sailingClasses: { id: string; code: string; name: string }[];
};

type LoginBucket = { attempts: number; expires: number };

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, LoginBucket>();

  constructor(private readonly db: PrismaService) {}

  private checkThrottle(email: string, ip: string): void {
    const now = Date.now();
    const key = ip + ':' + email;
    const bucket = this.attempts.get(key);
    if (!bucket || bucket.expires < now) {
      if (this.attempts.size > 5000) this.attempts.clear();
      this.attempts.set(key, { attempts: 0, expires: now + 15 * 60_000 });
      return;
    }
    if (bucket.attempts >= 6) throw new TooManyRequestsException('Demasiadas tentativas de acesso.');
  }

  private recordFailure(email: string, ip: string): void {
    const bucket = this.attempts.get(ip + ':' + email);
    if (bucket) bucket.attempts += 1;
  }

  async login(emailValue: string, password: string, ip: string): Promise<{
    token: string; profile: AuthProfile;
  }> {
    const email = emailValue.trim().toLowerCase();
    if (!email || email.length > 255 || !password || password.length > 128) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    this.checkThrottle(email, ip);
    const user = await this.db.user.findUnique({
      where: { email },
      include: { coachClasses: { include: { sailingClass: true } } },
    });
    // Faz uma operação de hashing também quando o email não existe.
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.active || !valid) {
      this.recordFailure(email, ip);
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    this.attempts.delete(ip + ':' + email);
    const token = randomBytes(32).toString('base64url');
    await this.db.authSession.create({
      data: {
        userId: user.id, tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
      },
    });
    return { token, profile: this.profileFor(user) };
  }

  private profileFor(user: {
    id: string; fullName: string; email: string; role: string;
    coachClasses: { sailingClass: { id: string; code: string; name: string; active: boolean } }[];
  }): AuthProfile {
    return {
      id: user.id, fullName: user.fullName, email: user.email, role: user.role,
      sailingClasses: user.coachClasses
        .filter((item) => item.sailingClass.active)
        .map((item) => ({
          id: item.sailingClass.id,
          code: item.sailingClass.code, name: item.sailingClass.name,
        })),
    };
  }

  async currentUser(cookieToken: string | undefined): Promise<AuthProfile> {
    if (!cookieToken || !/^[A-Za-z0-9_-]{43}$/.test(cookieToken)) {
      throw new UnauthorizedException('É necessário iniciar sessão.');
    }
    const session = await this.db.authSession.findUnique({
      where: { tokenHash: hashSessionToken(cookieToken) },
      include: { user: { include: { coachClasses: { include: { sailingClass: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.active) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    return this.profileFor(session.user);
  }

  async logout(cookieToken: string | undefined): Promise<void> {
    if (cookieToken && /^[A-Za-z0-9_-]{43}$/.test(cookieToken)) {
      await this.db.authSession.updateMany({
        where: { tokenHash: hashSessionToken(cookieToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
}

// Hash fixo, não é uma credencial. Verificação de tempo semelhante para emails desconhecidos.
const DUMMY_HASH = 'scrypt$16384$8$1$EREREREREREREREREREREQ$YlfYFAbbfOu6SnWX-wf0Z-FlnydSed9RRUSGF4jV0BAmcO_2e0z87FLT5Y-kG9J_Z9gZ-eOOGxm4jBqPoM6ptw';
