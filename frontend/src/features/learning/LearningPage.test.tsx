import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseProgressResponse, LessonResponse, MyEnrollmentResponse } from '@lms/shared';
import { listMyEnrollments } from '../../api/enrollments';
import { listLessons } from '../../api/lessons';
import { getMyCourseProgress, updateLessonProgress } from '../../api/progress';
import { useAuthStore } from '../auth/auth.store';
import { LearningPage } from './LearningPage';

vi.mock('../../api/courses', () => ({
  enrollCourse: vi.fn(),
}));

vi.mock('../../api/enrollments', () => ({
  listMyEnrollments: vi.fn(),
}));

vi.mock('../../api/lessons', () => ({
  listLessons: vi.fn(),
}));

vi.mock('../../api/progress', () => ({
  getMyCourseProgress: vi.fn(),
  updateLessonProgress: vi.fn(),
}));

vi.mock('./LessonNotesPanel', () => ({
  LessonNotesPanel: () => <section aria-label="Notes panel">Notes panel</section>,
}));

vi.mock('./LessonTranscriptPanel', () => ({
  LessonTranscriptPanel: () => <section aria-label="Transcript panel">Transcript panel</section>,
}));

vi.mock('./QuizReviewPanel', () => ({
  QuizReviewPanel: () => <section aria-label="Quiz review panel">Quiz review panel</section>,
}));

const mockedListMyEnrollments = vi.mocked(listMyEnrollments);
const mockedListLessons = vi.mocked(listLessons);
const mockedGetMyCourseProgress = vi.mocked(getMyCourseProgress);
const mockedUpdateLessonProgress = vi.mocked(updateLessonProgress);

describe('LearningPage', () => {
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
    mockedListMyEnrollments.mockReset();
    mockedListLessons.mockReset();
    mockedGetMyCourseProgress.mockReset();
    mockedUpdateLessonProgress.mockReset();
    mockedListMyEnrollments.mockResolvedValue([enrollmentFixture()]);
    mockedListLessons.mockResolvedValue(lessonsFixture());
    mockedGetMyCourseProgress.mockResolvedValue(progressFixture());
  });

  it('renders the learning route shell, lesson nav, and completion action', async () => {
    renderLearningPage();

    expect(await screen.findByRole('heading', { name: /Learning workspace/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Mark complete/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lesson 1: Intro lesson/i })).toBeInTheDocument();
  });

  it('keeps the learning workspace locked until the student enrolls', async () => {
    mockedListMyEnrollments.mockResolvedValue([]);

    renderLearningPage();

    expect((await screen.findAllByText('Enroll to unlock this workspace')).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole('heading', { name: /Learning workspace/i })).not.toBeInTheDocument();
    expect(mockedListLessons).not.toHaveBeenCalled();
    expect(mockedGetMyCourseProgress).not.toHaveBeenCalled();
  });
});

function renderLearningPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/courses/course-1/learn']}>
        <Routes>
          <Route path="/courses/:courseId/learn" element={<LearningPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function lessonsFixture(): LessonResponse[] {
  return [
    {
      courseId: 'course-1',
      createdAt: '2026-09-08T00:00:00.000Z',
      description: 'Start here',
      durationSeconds: 600,
      id: 'lesson-1',
      mediaAssetId: 'media-1',
      order: 1,
      title: 'Lesson 1: Intro lesson',
      updatedAt: '2026-09-08T00:00:00.000Z',
    },
    {
      courseId: 'course-1',
      createdAt: '2026-09-08T00:00:00.000Z',
      description: 'Practice realtime flows',
      durationSeconds: 900,
      id: 'lesson-2',
      mediaAssetId: null,
      order: 2,
      title: 'Lesson 2: Practice lab',
      updatedAt: '2026-09-08T00:00:00.000Z',
    },
  ];
}

function progressFixture(): CourseProgressResponse {
  return {
    completedLessons: 1,
    courseId: 'course-1',
    lessons: [
      {
        completedAt: null,
        durationSeconds: 600,
        lastWatchedAt: '2026-09-08T00:15:00.000Z',
        lessonId: 'lesson-1',
        positionSeconds: 240,
        title: 'Lesson 1: Intro lesson',
      },
      {
        completedAt: '2026-09-08T00:30:00.000Z',
        durationSeconds: 900,
        lastWatchedAt: '2026-09-08T00:30:00.000Z',
        lessonId: 'lesson-2',
        positionSeconds: 900,
        title: 'Lesson 2: Practice lab',
      },
    ],
    percent: 50,
    totalLessons: 2,
  };
}

function enrollmentFixture(overrides: Partial<MyEnrollmentResponse> = {}): MyEnrollmentResponse {
  return {
    course: {
      createdAt: '2026-08-28T00:00:00.000Z',
      description: 'Seed course for realtime practice',
      id: overrides.courseId ?? 'course-1',
      instructorId: 'instructor-1',
      publishedAt: '2026-08-28T00:00:00.000Z',
      slug: 'realtime-lms-foundations',
      status: 'PUBLISHED',
      title: 'Realtime LMS Foundations',
      updatedAt: '2026-08-28T00:00:00.000Z',
    },
    courseId: overrides.courseId ?? 'course-1',
    createdAt: '2026-08-28T00:00:00.000Z',
    id: 'enrollment-1',
    userId: 'student-1',
    ...overrides,
  };
}
