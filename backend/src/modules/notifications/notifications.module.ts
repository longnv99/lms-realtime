import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsProducer } from './notifications.producer';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsProcessor,
    NotificationsProducer,
    NotificationsService,
    WsAuthService,
  ],
  exports: [NotificationsProducer, NotificationsService],
})
export class NotificationsModule {}
