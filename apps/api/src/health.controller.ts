import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: string; service: string; version: string } {
    return { status: 'ok', service: 'fpv-planeamento-api', version: '0.1.0' };
  }
}
