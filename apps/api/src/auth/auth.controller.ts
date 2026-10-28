import {
  Body, Controller, Get, HttpCode, Post, Req, Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from './auth.service';
import { tokenFromRequest, validateSameOrigin } from './request';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.SESSION_COOKIE_SECURE !== 'false',
  sameSite: 'strict' as const,
  path: '/api',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response,
  ) {
    validateSameOrigin(req);
    const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const email = typeof input.email === 'string' ? input.email : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const result = await this.auth.login(email, password, req.ip ?? 'unknown');
    res.cookie(SESSION_COOKIE, result.token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS * 1000 });
    return { user: result.profile };
  }

  @Get('me')
  async me(@Req() req: Request) {
    return { user: await this.auth.currentUser(tokenFromRequest(req)) };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    validateSameOrigin(req);
    await this.auth.logout(tokenFromRequest(req));
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    return { status: 'signed_out' };
  }
}
