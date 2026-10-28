import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async getHealth(): Promise<{ status: string; service: string; version: string }> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'fpv-planeamento-api', version: '0.2.0' };
    } catch {
      throw new ServiceUnavailableException('Base de dados indisponível');
    }
  }
}
