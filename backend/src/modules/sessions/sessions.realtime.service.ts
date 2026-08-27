import { Injectable } from '@nestjs/common';
import type { ChatMessagePayload, SessionStatePayload } from '@lms/shared';

type RoomEmitter = {
  to(room: string): {
    emit(event: string, payload: unknown): void;
  };
};

@Injectable()
export class SessionsRealtimeService {
  private server?: RoomEmitter;

  registerServer(server: RoomEmitter): void {
    this.server = server;
  }

  emitSessionState(sessionId: string, payload: SessionStatePayload): void {
    this.server?.to(`session:${sessionId}`).emit('session:state', payload);
  }

  emitChatMessage(sessionId: string, payload: ChatMessagePayload): void {
    this.server?.to(`session:${sessionId}`).emit('chat:message', payload);
  }
}
