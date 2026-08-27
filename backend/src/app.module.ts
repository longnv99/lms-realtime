import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [EnvModule, PrismaModule, HealthModule, AuthModule, UsersModule],
})
export class AppModule {}
