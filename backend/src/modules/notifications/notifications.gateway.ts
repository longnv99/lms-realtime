import { UseFilters } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { NotificationPayload } from '@lms/shared';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { WsAllExceptionsFilter } from '../../common/realtime/ws-exception.filter';

@UseFilters(new WsAllExceptionsFilter())
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  constructor(private readonly wsAuth: WsAuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.wsAuth.authenticate(client);
      client.data.user = user;
      await client.join(`user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitNewNotification(userId: string, payload: NotificationPayload): void {
    this.server?.to(`user:${userId}`).emit('notification:new', payload);
  }
}
