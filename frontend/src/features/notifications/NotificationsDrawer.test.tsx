import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationPayload, NotificationResponse } from '@lms/shared';
import { listNotifications, markNotificationRead } from '../../api/notifications';
import { createNamespaceSocket } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
import { NotificationsButton } from './NotificationsButton';

type SocketHandler = (payload: unknown) => void;
type MockedNotificationSocket = {
  disconnect: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  on: (event: string, handler: SocketHandler) => MockedNotificationSocket;
};

const socketHandlers = new Map<string, SocketHandler>();
const onMock = vi.fn((event: string, handler: SocketHandler): MockedNotificationSocket => {
  socketHandlers.set(event, handler);
  return mockedSocket;
});
const mockedSocket: MockedNotificationSocket = {
  disconnect: vi.fn(),
  off: vi.fn(),
  on: onMock,
};

vi.mock('../../api/notifications', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('../../lib/realtime', () => ({
  createNamespaceSocket: vi.fn(() => mockedSocket),
}));

const mockedCreateNamespaceSocket = vi.mocked(createNamespaceSocket);
const mockedListNotifications = vi.mocked(listNotifications);
const mockedMarkNotificationRead = vi.mocked(markNotificationRead);

describe('NotificationsButton', () => {
  beforeEach(() => {
    localStorage.clear();
    socketHandlers.clear();
    mockedSocket.disconnect.mockClear();
    mockedSocket.off.mockClear();
    onMock.mockClear();
    mockedCreateNamespaceSocket.mockClear();
    mockedListNotifications.mockReset();
    mockedMarkNotificationRead.mockReset();
    mockedListNotifications.mockResolvedValue([
      notification({ id: 'read-1', readAt: '2026-08-28T07:00:00.000Z', title: 'Already read' }),
      notification({ id: 'unread-1', title: 'Course published' }),
    ]);
    mockedMarkNotificationRead.mockImplementation(async (id) =>
      notification({ id, readAt: '2026-08-28T07:05:00.000Z', title: 'Course published' }),
    );
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

  it('shows unread count, receives realtime notifications, and marks rows read', async () => {
    renderNotificationsButton();

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(mockedCreateNamespaceSocket).toHaveBeenCalledWith('/notifications', 'access-token');

    act(() => {
      socketHandlers.get('notification:new')?.({
        body: 'Live class is open',
        createdAt: '2026-08-28T07:10:00.000Z',
        id: 'new-1',
        title: 'Session live',
        type: 'SESSION_LIVE',
      } satisfies NotificationPayload);
    });

    expect(screen.getByText('2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }));
    const drawer = screen.getByRole('dialog', { name: /notifications/i });
    const rows = within(drawer).getAllByTestId('notification-row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Session liveLive class is openUnread',
      'Already readBody',
      'Course publishedBodyUnread',
    ]);

    await userEvent.click(within(drawer).getByRole('button', { name: /mark session live read/i }));

    expect(mockedMarkNotificationRead.mock.calls[0]?.[0]).toBe('new-1');
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

function renderNotificationsButton() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsButton />
    </QueryClientProvider>,
  );
}

function notification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    body: 'Body',
    createdAt: '2026-08-28T07:00:00.000Z',
    id: 'notification-1',
    readAt: null,
    title: 'Course published',
    type: 'COURSE_PUBLISHED',
    ...overrides,
  };
}
