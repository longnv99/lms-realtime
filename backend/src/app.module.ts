import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoursesModule } from './modules/courses/courses.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { LearningModule } from './modules/learning/learning.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProgressModule } from './modules/progress/progress.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { env } from './config/env';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    EnvModule,
    RedisModule,
    ...(env.NODE_ENV === 'test' ? [] : [QueueModule]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MediaModule,
    CoursesModule,
    EnrollmentsModule,
    LessonsModule,
    LearningModule,
    SessionsModule,
    QuizzesModule,
    NotificationsModule,
    ProgressModule,
  ],
})
export class AppModule {}
