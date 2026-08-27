import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { CoursesModule } from '../courses/courses.module';
import { SessionsController } from './sessions.controller';
import { SessionsGateway } from './sessions.gateway';
import { SessionsRealtimeService } from './sessions.realtime.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [CoursesModule, JwtModule.register({})],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsGateway, SessionsRealtimeService, WsAuthService],
})
export class SessionsModule {}
