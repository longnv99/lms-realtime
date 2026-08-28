import { io, Socket } from 'socket.io-client';

export async function connectSocket(
  baseUrl: string,
  namespace: '/sessions' | '/quiz' | '/notifications',
  token: string,
): Promise<Socket> {
  const socket = io(`${baseUrl}${namespace}`, {
    auth: { token },
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

  return socket;
}
