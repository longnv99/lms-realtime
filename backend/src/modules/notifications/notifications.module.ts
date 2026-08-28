import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { env } from '../../config/env';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsProducer } from './notifications.producer';
import { NotificationsService } from './notifications.service';

const notificationsProducerProvider =
  env.NODE_ENV === 'test'
    ? {
        provide: NotificationsProducer,
        useValue: {
          enqueueCoursePublished: async () => undefined,
        },
      }
    : NotificationsProducer;

const providers = [
  NotificationsGateway,
  notificationsProducerProvider,
  NotificationsService,
  WsAuthService,
  ...(env.NODE_ENV === 'test' ? [] : [NotificationsProcessor]),
];

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers,
  exports: [NotificationsProducer, NotificationsService],
})
export class NotificationsModule {}
