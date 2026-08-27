import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoursesModule } from './modules/courses/courses.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    EnrollmentsModule,
    LessonsModule,
    SessionsModule,
  ],
})
export class AppModule {}
