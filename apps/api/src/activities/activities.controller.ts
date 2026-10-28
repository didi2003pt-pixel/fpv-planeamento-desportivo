import {
  Body, Controller, Get, Param, Patch, Post, Query, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { tokenFromRequest, validateSameOrigin } from '../auth/request';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly auth: AuthService,
    private readonly activities: ActivitiesService,
  ) {}

  @Get()
  async list(@Req() request: Request, @Query('from') from: string, @Query('to') to: string) {
    const user = await this.auth.currentUser(tokenFromRequest(request));
    return this.activities.list(user, from, to);
  }

  @Get(':id')
  async get(@Req() request: Request, @Param('id') id: string) {
    const user = await this.auth.currentUser(tokenFromRequest(request));
    return this.activities.get(user, id);
  }

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    validateSameOrigin(request);
    const user = await this.auth.currentUser(tokenFromRequest(request));
    return this.activities.create(user, body);
  }

  @Patch(':id')
  async patch(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    validateSameOrigin(request);
    const user = await this.auth.currentUser(tokenFromRequest(request));
    return this.activities.patch(user, id, body);
  }

  @Post(':id/confirm-monthly')
  async confirmMonthly(
    @Req() request: Request, @Param('id') id: string, @Body() body: unknown,
  ) {
    validateSameOrigin(request);
    const user = await this.auth.currentUser(tokenFromRequest(request));
    return this.activities.confirmMonth(user, id, body);
  }
}

@Controller('classes')
export class ClassesController {
  constructor(
    private readonly auth: AuthService,
    private readonly activities: ActivitiesService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const user = await this.auth.currentUser(tokenFromRequest(request));
    return { items: await this.activities.classes(user) };
  }
}
