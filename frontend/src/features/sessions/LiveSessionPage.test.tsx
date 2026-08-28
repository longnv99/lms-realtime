import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessagePayload, SessionStatePayload } from '@lms/shared';
import { getSessionState } from '../../api/sessions';
import { createNamespaceSocket } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
import { LiveSessionPage } from './LiveSessionPage';

type SocketHandler = (payload: unknown) => void;
type MockedLiveSocket = {
  disconnect: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  on: (event: string, handler: SocketHandler) => MockedLiveSocket;
};

const socketHandlers = new Map<string, SocketHandler>();
const onMock = vi.fn((event: string, handler: SocketHandler): MockedLiveSocket => {
  socketHandlers.set(event, handler);
  return mockedSocket;
});
const mockedSocket: MockedLiveSocket = {
  disconnect: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  on: onMock,
};

vi.mock('../../api/sessions', () => ({
  getSessionState: vi.fn(),
}));

vi.mock('../../lib/realtime', () => ({
  createNamespaceSocket: vi.fn(() => mockedSocket),
  useSocketStatus: vi.fn(() => 'connected'),
}));

const mockedCreateNamespaceSocket = vi.mocked(createNamespaceSocket);
const mockedGetSessionState = vi.mocked(getSessionState);

describe('LiveSessionPage', () => {
  beforeEach(() => {
    localStorage.clear();
    socketHandlers.clear();
    mockedSocket.disconnect.mockClear();
    mockedSocket.emit.mockClear();
    mockedSocket.off.mockClear();
    onMock.mockClear();
    mockedCreateNamespaceSocket.mockClear();
    mockedGetSessionState.mockReset();
    mockedGetSessionState.mockResolvedValue({
      id: 'session-1',
      participantCount: 0,
      status: 'LIVE',
    });
    useAuthStore.setState({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        email: 'student@example.com',
        id: 'student-1',
        name: 'Student',
        role: 'STUDENT',
      },
    });
  });

  it('joins the session and renders participant count from socket state', async () => {
    renderLiveSessionPage();

    await waitFor(() => {
      expect(mockedCreateNamespaceSocket).toHaveBeenCalledWith('/sessions', 'access-token');
      expect(mockedSocket.emit).toHaveBeenCalledWith('session:join', {
        sessionId: 'session-1',
      });
    });

    act(() => {
      socketHandlers.get('session:state')?.({
        id: 'session-1',
        participantCount: 3,
        status: 'LIVE',
      } satisfies SessionStatePayload);
    });

    expect(screen.getByText('3 online')).toBeInTheDocument();
  });

  it('appends incoming chat messages and sends composer text', async () => {
    renderLiveSessionPage();

    await screen.findByText('0 online');

    act(() => {
      socketHandlers.get('chat:message')?.({
        content: 'Welcome to class',
        createdAt: '2026-08-28T07:00:00.000Z',
        id: 'message-1',
        name: 'Instructor',
        sessionId: 'session-1',
        userId: 'instructor-1',
      } satisfies ChatMessagePayload);
    });

    expect(screen.getByText('Instructor')).toBeInTheDocument();
    expect(screen.getByText('Welcome to class')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/chat message/i), 'Hello class');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(mockedSocket.emit).toHaveBeenCalledWith('chat:send', {
      content: 'Hello class',
      sessionId: 'session-1',
    });
  });
});

function renderLiveSessionPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/sessions/session-1/live']}>
        <Routes>
          <Route path="/sessions/:sessionId/live" element={<LiveSessionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
