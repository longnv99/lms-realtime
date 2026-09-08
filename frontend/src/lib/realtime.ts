import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ProgressHeartbeatPayload } from '@lms/shared';

export type RealtimeNamespace = '/sessions' | '/quiz' | '/notifications';
export type SocketStatus = 'connected' | 'disconnected';

export type RealtimeSocket = {
  connected: boolean;
  off: (event: 'connect' | 'disconnect', handler: () => void) => unknown;
  on: (event: 'connect' | 'disconnect', handler: () => void) => unknown;
};

export function createNamespaceSocket(namespace: RealtimeNamespace, token: string): Socket {
  return io(namespace, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    transports: ['websocket'],
  });
}

export function createOptionalNamespaceSocket(
  namespace: RealtimeNamespace,
  token: string | null | undefined,
): Socket | null {
  if (!token) {
    return null;
  }

  return createNamespaceSocket(namespace, token);
}

export function emitProgressHeartbeat(
  socket: { emit: (event: 'progress:heartbeat', payload: ProgressHeartbeatPayload) => unknown },
  payload: ProgressHeartbeatPayload,
): void {
  socket.emit('progress:heartbeat', payload);
}

export function useSocketStatus(socket: RealtimeSocket | null): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(
    socket?.connected ? 'connected' : 'disconnected',
  );

  useEffect(() => {
    if (!socket) {
      setStatus('disconnected');
      return undefined;
    }

    const handleConnect = () => setStatus('connected');
    const handleDisconnect = () => setStatus('disconnected');

    setStatus(socket.connected ? 'connected' : 'disconnected');
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  return status;
}
