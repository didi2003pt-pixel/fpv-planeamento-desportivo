import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { ActivitiesController, ClassesController } from './activities/activities.controller';
import { ActivitiesService } from './activities/activities.service';

@Module({
  controllers: [HealthController, AuthController, ActivitiesController, ClassesController],
  providers: [PrismaService, AuthService, ActivitiesService],
})
export class AppModule {}
