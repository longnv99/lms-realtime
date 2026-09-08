import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CourseProgressResponse,
  CourseResponse,
  InstructorCourseProgressResponse,
  ProgressUpdatedPayload,
  SessionResponse,
} from '@lms/shared';
import { getCourse } from '../../api/courses';
import { getCourseProgress, getMyCourseProgress } from '../../api/progress';
import { listSessions } from '../../api/sessions';
import { createNamespaceSocket } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
import { CourseDetailPage } from './CourseDetailPage';

vi.mock('../../api/courses', () => ({
  getCourse: vi.fn(),
}));

vi.mock('../../api/progress', () => ({
  getCourseProgress: vi.fn(),
  getMyCourseProgress: vi.fn(),
}));

vi.mock('../../api/sessions', () => ({
  listSessions: vi.fn(),
}));

vi.mock('../../lib/realtime', () => ({
  createNamespaceSocket: vi.fn(() => mockedSocket),
}));

vi.mock('../lessons/LessonsPanel', () => ({
  LessonsPanel: ({ canManage }: { canManage: boolean }) => (
    <section aria-label="Lessons panel">{canManage ? 'Lesson management' : 'Lessons'}</section>
  ),
}));

vi.mock('../sessions/SessionsPanel', () => ({
  SessionsPanel: ({ canManage }: { canManage: boolean }) => (
    <section aria-label="Sessions panel">{canManage ? 'Session management' : 'Sessions'}</section>
  ),
}));

const socketHandlers: Partial<
  Record<'progress:updated', (payload: ProgressUpdatedPayload) => void>
> = {};

type MockedCourseSocket = {
  disconnect: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  on: (
    event: 'progress:updated',
    handler: (payload: ProgressUpdatedPayload) => void,
  ) => MockedCourseSocket;
};

const onMock = vi.fn(
  (
    event: 'progress:updated',
    handler: (payload: ProgressUpdatedPayload) => void,
  ): MockedCourseSocket => {
    socketHandlers[event] = handler;
    return mockedSocket;
  },
);

const mockedSocket: MockedCourseSocket = {
  disconnect: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  on: onMock,
};

const mockedCreateNamespaceSocket = vi.mocked(createNamespaceSocket);
const mockedGetCourse = vi.mocked(getCourse);
const mockedGetCourseProgress = vi.mocked(getCourseProgress);
const mockedGetMyCourseProgress = vi.mocked(getMyCourseProgress);
const mockedListSessions = vi.mocked(listSessions);

describe('CourseDetailPage progress surfaces', () => {
  beforeEach(() => {
    localStorage.clear();
    socketHandlers['progress:updated'] = undefined;
    mockedSocket.disconnect.mockClear();
    mockedSocket.emit.mockClear();
    mockedSocket.off.mockClear();
    onMock.mockClear();
    mockedCreateNamespaceSocket.mockClear();
    mockedGetCourse.mockReset();
    mockedGetCourseProgress.mockReset();
    mockedGetMyCourseProgress.mockReset();
    mockedListSessions.mockReset();
    mockedGetCourse.mockResolvedValue(courseFixture());
    mockedGetMyCourseProgress.mockResolvedValue(studentProgressFixture());
    mockedGetCourseProgress.mockResolvedValue(instructorProgressFixture());
    mockedListSessions.mockResolvedValue([]);
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

  it('renders student course percent, completion count, and lesson rows', async () => {
    renderCourseDetail();

    expect(await screen.findByText('Learning progress')).toBeInTheDocument();
    expect(await screen.findByText('1 of 2 completed')).toBeInTheDocument();
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    expect(screen.getByText('Intro lesson')).toBeInTheDocument();
    expect(screen.getByText('Practice lab')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('67% watched')).toBeInTheDocument();
    expect(mockedGetMyCourseProgress).toHaveBeenCalledWith('course-1');
    expect(mockedGetCourseProgress).not.toHaveBeenCalled();
  });

  it('renders instructor per-student progress rows', async () => {
    useAuthStore.setState({
      user: {
        email: 'instructor@example.com',
        id: 'instructor-1',
        name: 'Instructor',
        role: 'INSTRUCTOR',
      },
    });

    renderCourseDetail();

    expect(await screen.findByText('Learner progress')).toBeInTheDocument();
    expect(await screen.findByText('Student One')).toBeInTheDocument();
    expect(screen.getByText('student.one@example.com')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('No activity')).toBeInTheDocument();
    expect(mockedGetCourseProgress).toHaveBeenCalledWith('course-1');
    expect(mockedGetMyCourseProgress).not.toHaveBeenCalled();
  });

  it('invalidates progress queries when matching realtime updates arrive', async () => {
    useAuthStore.setState({
      user: {
        email: 'instructor@example.com',
        id: 'instructor-1',
        name: 'Instructor',
        role: 'INSTRUCTOR',
      },
    });
    mockedListSessions.mockResolvedValue([
      sessionFixture({ id: 'session-live', status: 'LIVE', title: 'Current room' }),
    ]);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderCourseDetail(queryClient);

    await waitFor(() => {
      expect(mockedSocket.emit).toHaveBeenCalledWith('session:join', { sessionId: 'session-live' });
    });

    act(() => {
      socketHandlers['progress:updated']?.({
        courseId: 'course-1',
        lessonId: 'lesson-2',
        percent: 100,
        userId: 'student-1',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['course-progress', 'course-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['my-course-progress', 'course-1'] });
  });

  it('renders an English empty progress state without raw course ids', async () => {
    mockedGetMyCourseProgress.mockResolvedValue(
      studentProgressFixture({ completedLessons: 0, lessons: [], percent: 0, totalLessons: 0 }),
    );

    renderCourseDetail();

    expect(await screen.findByText('No progress yet')).toBeInTheDocument();
    expect(
      screen.getByText('Start a lesson video to build your progress history.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('course-1')).not.toBeInTheDocument();
  });
});

function renderCourseDetail(queryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/courses/course-1']}>
        <Routes>
          <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function courseFixture(overrides: Partial<CourseResponse> = {}): CourseResponse {
  return {
    createdAt: '2026-08-28T00:00:00.000Z',
    description: 'Seed course for realtime practice',
    id: 'course-1',
    instructorId: 'instructor-1',
    publishedAt: '2026-08-28T00:00:00.000Z',
    slug: 'realtime-lms-foundations',
    status: 'PUBLISHED',
    title: 'Realtime LMS Foundations',
    updatedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}

function studentProgressFixture(
  overrides: Partial<CourseProgressResponse> = {},
): CourseProgressResponse {
  return {
    completedLessons: 1,
    courseId: 'course-1',
    lessons: [
      {
        completedAt: '2026-09-08T01:00:00.000Z',
        durationSeconds: 600,
        lastWatchedAt: '2026-09-08T01:00:00.000Z',
        lessonId: 'lesson-1',
        positionSeconds: 600,
        title: 'Intro lesson',
      },
      {
        completedAt: null,
        durationSeconds: 900,
        lastWatchedAt: '2026-09-08T01:10:00.000Z',
        lessonId: 'lesson-2',
        positionSeconds: 600,
        title: 'Practice lab',
      },
    ],
    percent: 50,
    totalLessons: 2,
    ...overrides,
  };
}

function instructorProgressFixture(
  overrides: Partial<InstructorCourseProgressResponse> = {},
): InstructorCourseProgressResponse {
  return {
    courseId: 'course-1',
    students: [
      {
        completedLessons: 2,
        email: 'student.one@example.com',
        lastWatchedAt: '2026-09-08T01:10:00.000Z',
        name: 'Student One',
        percent: 67,
        userId: 'student-1',
      },
      {
        completedLessons: 0,
        email: 'student.two@example.com',
        lastWatchedAt: null,
        name: 'Student Two',
        percent: 0,
        userId: 'student-2',
      },
    ],
    totalLessons: 3,
    ...overrides,
  };
}

function sessionFixture(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    courseId: 'course-1',
    createdAt: '2026-09-08T00:00:00.000Z',
    endsAt: null,
    id: 'session-1',
    startsAt: '2026-09-08T01:00:00.000Z',
    status: 'LIVE',
    title: 'Live session',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}
