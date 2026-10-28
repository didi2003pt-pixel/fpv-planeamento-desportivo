import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { ActivitiesController, ClassesController } from './activities/activities.controller';
import { ActivitiesService } from './activities/activities.service';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';

@Module({
  controllers: [HealthController, AuthController, ActivitiesController, ClassesController, AdminController],
  providers: [PrismaService, AuthService, ActivitiesService, AdminService],
})
export class AppModule {}
