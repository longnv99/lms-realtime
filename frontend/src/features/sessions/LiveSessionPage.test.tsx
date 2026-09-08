import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessagePayload, LessonResponse, SessionStatePayload } from '@lms/shared';
import { getMediaPlayback } from '../../api/media';
import { listLessons } from '../../api/lessons';
import { getSessionState } from '../../api/sessions';
import { createNamespaceSocket, emitProgressHeartbeat } from '../../lib/realtime';
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

vi.mock('../../api/lessons', () => ({
  listLessons: vi.fn(),
}));

vi.mock('../../api/media', () => ({
  getMediaPlayback: vi.fn(),
}));

vi.mock('../../lib/realtime', () => ({
  createNamespaceSocket: vi.fn(() => mockedSocket),
  emitProgressHeartbeat: vi.fn(),
  useSocketStatus: vi.fn(() => 'connected'),
}));

vi.mock('../quizzes/QuizPanel', () => ({
  QuizPanel: ({ sessionId }: { sessionId: string }) => <div>Quiz panel {sessionId}</div>,
}));

const mockedCreateNamespaceSocket = vi.mocked(createNamespaceSocket);
const mockedEmitProgressHeartbeat = vi.mocked(emitProgressHeartbeat);
const mockedGetMediaPlayback = vi.mocked(getMediaPlayback);
const mockedGetSessionState = vi.mocked(getSessionState);
const mockedListLessons = vi.mocked(listLessons);

describe('LiveSessionPage', () => {
  beforeEach(() => {
    localStorage.clear();
    socketHandlers.clear();
    mockedSocket.disconnect.mockClear();
    mockedSocket.emit.mockClear();
    mockedSocket.off.mockClear();
    onMock.mockClear();
    mockedCreateNamespaceSocket.mockClear();
    mockedEmitProgressHeartbeat.mockClear();
    mockedGetMediaPlayback.mockReset();
    mockedGetSessionState.mockReset();
    mockedListLessons.mockReset();
    mockedGetSessionState.mockResolvedValue({
      id: 'session-1',
      participantCount: 0,
      status: 'LIVE',
    });
    mockedListLessons.mockResolvedValue([
      createLessonFixture({
        id: 'lesson-1',
        mediaAssetId: 'asset-1',
        title: 'Intro lesson',
      }),
      createLessonFixture({
        id: 'lesson-2',
        mediaAssetId: null,
        order: 2,
        title: 'Practice',
      }),
    ]);
    mockedGetMediaPlayback.mockResolvedValue({
      assetId: 'asset-1',
      expiresInSeconds: 1800,
      playbackUrl: 'http://localhost:9000/playback.mp4',
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

  it('renders lesson playback for attached media', async () => {
    renderLiveSessionPage();

    expect(await screen.findByLabelText(/lesson video/i)).toBeInTheDocument();
    expect(mockedListLessons).toHaveBeenCalledWith('course-1');
    expect(await screen.findByLabelText(/video player for intro lesson/i)).toHaveAttribute(
      'src',
      'http://localhost:9000/playback.mp4',
    );
  });

  it('shows an empty media state when the selected lesson has no video', async () => {
    renderLiveSessionPage();

    await userEvent.selectOptions(await screen.findByLabelText(/lesson video/i), 'lesson-2');

    expect(screen.getByText('No video attached')).toBeInTheDocument();
  });

  it('emits throttled watch heartbeats from video progress', async () => {
    renderLiveSessionPage();
    const player = await screen.findByLabelText(/video player for intro lesson/i);

    setVideoTime(player, 12);
    fireEvent.timeUpdate(player);
    setVideoTime(player, 15);
    fireEvent.timeUpdate(player);
    setVideoTime(player, 22);
    fireEvent.timeUpdate(player);

    expect(mockedEmitProgressHeartbeat).toHaveBeenCalledTimes(2);
    expect(mockedEmitProgressHeartbeat).toHaveBeenNthCalledWith(1, mockedSocket, {
      lessonId: 'lesson-1',
      positionSeconds: 12,
    });
    expect(mockedEmitProgressHeartbeat).toHaveBeenNthCalledWith(2, mockedSocket, {
      lessonId: 'lesson-1',
      positionSeconds: 22,
    });
  });
});

function renderLiveSessionPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/courses/course-1/sessions/session-1/live']}>
        <Routes>
          <Route path="/courses/:courseId/sessions/:sessionId/live" element={<LiveSessionPage />} />
          <Route path="/sessions/:sessionId/live" element={<LiveSessionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function createLessonFixture(overrides: Partial<LessonResponse> = {}): LessonResponse {
  return {
    courseId: 'course-1',
    createdAt: '2026-09-08T00:00:00.000Z',
    description: 'Lesson description',
    durationSeconds: 120,
    id: 'lesson-1',
    mediaAssetId: null,
    order: 1,
    title: 'Lesson',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

function setVideoTime(element: HTMLElement, currentTime: number): void {
  Object.defineProperty(element, 'currentTime', {
    configurable: true,
    value: currentTime,
  });
}
