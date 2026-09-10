import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseProgressResponse, LessonResponse } from '@lms/shared';
import { listLessons } from '../../api/lessons';
import { getMyCourseProgress, updateLessonProgress } from '../../api/progress';
import { LearningPage } from './LearningPage';

vi.mock('../../api/lessons', () => ({
  listLessons: vi.fn(),
}));

vi.mock('../../api/progress', () => ({
  getMyCourseProgress: vi.fn(),
  updateLessonProgress: vi.fn(),
}));

const mockedListLessons = vi.mocked(listLessons);
const mockedGetMyCourseProgress = vi.mocked(getMyCourseProgress);
const mockedUpdateLessonProgress = vi.mocked(updateLessonProgress);

describe('LearningPage', () => {
  beforeEach(() => {
    mockedListLessons.mockReset();
    mockedGetMyCourseProgress.mockReset();
    mockedUpdateLessonProgress.mockReset();
    mockedListLessons.mockResolvedValue(lessonsFixture());
    mockedGetMyCourseProgress.mockResolvedValue(progressFixture());
  });

  it('renders the learning route shell, lesson nav, and completion action', async () => {
    renderLearningPage();

    expect(await screen.findByRole('heading', { name: /Learning workspace/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Mark complete/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lesson 1: Intro lesson/i })).toBeInTheDocument();
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
