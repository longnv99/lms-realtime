import { ArgumentsHost, Catch, WsExceptionFilter } from '@nestjs/common';
import { Socket } from 'socket.io';

@Catch()
export class WsAllExceptionsFilter implements WsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const message = exception instanceof Error ? exception.message : 'WebSocket error';
    client.emit('error', { message });
  }
}
