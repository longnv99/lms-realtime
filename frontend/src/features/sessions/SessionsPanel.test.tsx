import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseResponse, LessonResponse, SessionResponse } from '@lms/shared';
import { getCourse } from '../../api/courses';
import { listLessons } from '../../api/lessons';
import { getCourseProgress, getMyCourseProgress } from '../../api/progress';
import { listSessions, startSession } from '../../api/sessions';
import { CourseDetailPage } from '../courses/CourseDetailPage';
import { useAuthStore } from '../auth/auth.store';

vi.mock('../../api/courses', () => ({
  getCourse: vi.fn(),
}));

vi.mock('../../api/lessons', () => ({
  createLesson: vi.fn(),
  listLessons: vi.fn(),
}));

vi.mock('../../api/progress', () => ({
  getCourseProgress: vi.fn(),
  getMyCourseProgress: vi.fn(),
}));

vi.mock('../../api/sessions', () => ({
  createSession: vi.fn(),
  endSession: vi.fn(),
  listSessions: vi.fn(),
  startSession: vi.fn(),
}));

const mockedGetCourse = vi.mocked(getCourse);
const mockedGetCourseProgress = vi.mocked(getCourseProgress);
const mockedGetMyCourseProgress = vi.mocked(getMyCourseProgress);
const mockedListLessons = vi.mocked(listLessons);
const mockedListSessions = vi.mocked(listSessions);
const mockedStartSession = vi.mocked(startSession);

describe('Course detail panels', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      accessToken: 'token',
      refreshToken: 'refresh-token',
      user: {
        email: 'student@example.com',
        id: 'student-1',
        name: 'Student',
        role: 'STUDENT',
      },
    });
    mockedGetCourse.mockReset();
    mockedGetCourseProgress.mockReset();
    mockedGetMyCourseProgress.mockReset();
    mockedListLessons.mockReset();
    mockedListSessions.mockReset();
    mockedStartSession.mockReset();
    mockedGetCourse.mockResolvedValue(course());
    mockedGetCourseProgress.mockResolvedValue({
      courseId: 'course-1',
      students: [],
      totalLessons: 0,
    });
    mockedGetMyCourseProgress.mockResolvedValue({
      completedLessons: 0,
      courseId: 'course-1',
      lessons: [],
      percent: 0,
      totalLessons: 0,
    });
  });

  it('sorts lessons and shows live entry only for live sessions', async () => {
    mockedListLessons.mockResolvedValue([
      lesson({ id: 'lesson-2', order: 2, title: 'Second lesson' }),
      lesson({ id: 'lesson-1', order: 1, title: 'First lesson' }),
    ]);
    mockedListSessions.mockResolvedValue([
      session({ id: 'session-ended', status: 'ENDED', title: 'Ended review' }),
      session({ id: 'session-live', status: 'LIVE', title: 'Live room' }),
      session({ id: 'session-scheduled', status: 'SCHEDULED', title: 'Scheduled workshop' }),
    ]);

    renderCourseDetail();

    const titles = await screen.findAllByTestId('lesson-row-title');
    expect(titles.map((title) => title.textContent)).toEqual(['First lesson', 'Second lesson']);
    expect(screen.getByRole('link', { name: /enter live room live room/i })).toHaveAttribute(
      'href',
      '/courses/course-1/sessions/session-live/live',
    );
    expect(
      screen.queryByRole('link', { name: /enter live room ended review/i }),
    ).not.toBeInTheDocument();
  });

  it('lets instructors start scheduled sessions', async () => {
    useAuthStore.setState({
      user: {
        email: 'instructor@example.com',
        id: 'instructor-1',
        name: 'Instructor',
        role: 'INSTRUCTOR',
      },
    });
    mockedListLessons.mockResolvedValue([]);
    mockedListSessions.mockResolvedValue([
      session({ id: 'session-scheduled', status: 'SCHEDULED', title: 'Scheduled workshop' }),
    ]);
    mockedStartSession.mockResolvedValue(
      session({ id: 'session-scheduled', status: 'LIVE', title: 'Scheduled workshop' }),
    );

    renderCourseDetail();

    await userEvent.click(await screen.findByRole('button', { name: /start scheduled workshop/i }));

    expect(mockedStartSession).toHaveBeenCalledWith('session-scheduled');
  });
});

function renderCourseDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

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

function course(overrides: Partial<CourseResponse> = {}): CourseResponse {
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

function lesson(overrides: Partial<LessonResponse> = {}): LessonResponse {
  return {
    courseId: 'course-1',
    createdAt: '2026-08-28T00:00:00.000Z',
    description: 'Practice material',
    durationSeconds: 900,
    id: 'lesson-1',
    mediaAssetId: null,
    order: 1,
    title: 'First lesson',
    updatedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}

function session(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    courseId: 'course-1',
    createdAt: '2026-08-28T00:00:00.000Z',
    endsAt: null,
    id: 'session-live',
    startsAt: '2026-08-29T01:00:00.000Z',
    status: 'LIVE',
    title: 'Live room',
    updatedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}
