import {
  Body, Controller, Get, Param, Patch, Post, Put, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { tokenFromRequest, validateSameOrigin } from '../auth/request';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly admin: AdminService,
  ) {}

  @Get('users')
  async users(@Req() req: Request) {
    return this.admin.listAccounts(await this.auth.currentUser(tokenFromRequest(req)));
  }

  @Get('classes')
  async classes(@Req() req: Request) {
    return this.admin.listClasses(await this.auth.currentUser(tokenFromRequest(req)));
  }

  @Post('classes')
  async createClass(@Req() req: Request, @Body() body: unknown) {
    validateSameOrigin(req);
    return this.admin.createClass(await this.auth.currentUser(tokenFromRequest(req)), body);
  }

  @Post('users')
  async createUser(@Req() req: Request, @Body() body: unknown) {
    validateSameOrigin(req);
    return this.admin.createAccount(await this.auth.currentUser(tokenFromRequest(req)), body);
  }

  @Put('users/:id/classes')
  async assignClasses(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    validateSameOrigin(req);
    return this.admin.assignClasses(await this.auth.currentUser(tokenFromRequest(req)), id, body);
  }

  @Patch('users/:id/status')
  async status(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    validateSameOrigin(req);
    return this.admin.updateAccountStatus(
      await this.auth.currentUser(tokenFromRequest(req)), id, body,
    );
  }
}
