import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import {
  createNamespaceSocket,
  createOptionalNamespaceSocket,
  emitProgressHeartbeat,
  useSocketStatus,
  type RealtimeSocket,
} from './realtime';

type Handler = () => void;
type MockedSocket = {
  connected: boolean;
  emit: ReturnType<typeof vi.fn>;
  off: (event: string, handler: Handler) => MockedSocket;
  on: (event: string, handler: Handler) => MockedSocket;
};

const emitMock = vi.fn();
const handlers = new Map<string, Handler>();
const offMock = vi.fn((_event: string, _handler: Handler): MockedSocket => mockedSocket);
const onMock = vi.fn((event: string, handler: Handler): MockedSocket => {
  handlers.set(event, handler);
  return mockedSocket;
});
const mockedSocket: MockedSocket = {
  connected: false,
  emit: emitMock,
  off: offMock,
  on: onMock,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockedSocket),
}));

const mockedIo = vi.mocked(io);

describe('realtime socket helpers', () => {
  beforeEach(() => {
    handlers.clear();
    emitMock.mockClear();
    vi.stubEnv('VITE_SOCKET_URL', 'http://localhost:4000');
    mockedIo.mockClear();
    mockedSocket.connected = false;
    offMock.mockClear();
    onMock.mockClear();
  });

  it('creates namespace sockets with auth and bounded reconnect options', () => {
    const socket = createNamespaceSocket('/sessions', 'access-token');

    expect(socket).toBe(mockedSocket);
    expect(mockedIo).toHaveBeenCalledWith('http://localhost:4000/sessions', {
      auth: { token: 'access-token' },
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      transports: ['websocket'],
    });
  });

  it('falls back to relative namespace sockets without a socket base URL', () => {
    vi.stubEnv('VITE_SOCKET_URL', '');

    createNamespaceSocket('/notifications', 'access-token');

    expect(mockedIo).toHaveBeenCalledWith('/notifications', expect.any(Object));
  });

  it('does not create optional sockets without a token', () => {
    expect(createOptionalNamespaceSocket('/quiz', null)).toBeNull();
    expect(mockedIo).not.toHaveBeenCalled();
  });

  it('tracks socket connection status', () => {
    const { result } = renderHook(() => useSocketStatus(mockedSocket as RealtimeSocket));

    expect(result.current).toBe('disconnected');

    act(() => {
      mockedSocket.connected = true;
      handlers.get('connect')?.();
    });
    expect(result.current).toBe('connected');

    act(() => {
      mockedSocket.connected = false;
      handlers.get('disconnect')?.();
    });
    expect(result.current).toBe('disconnected');
  });

  it('emits progress heartbeats through an existing sessions socket', () => {
    emitProgressHeartbeat(mockedSocket, { lessonId: 'lesson-1', positionSeconds: 42 });

    expect(emitMock).toHaveBeenCalledWith('progress:heartbeat', {
      lessonId: 'lesson-1',
      positionSeconds: 42,
    });
  });
});
