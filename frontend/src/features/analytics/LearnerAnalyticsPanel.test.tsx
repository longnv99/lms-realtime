import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearnerCourseAnalyticsResponse } from '@lms/shared';
import { getMyCourseAnalytics } from '../../api/analytics';
import { LearnerAnalyticsPanel } from './LearnerAnalyticsPanel';

vi.mock('../../api/analytics', () => ({
  getMyCourseAnalytics: vi.fn(),
}));

const mockedGetMyCourseAnalytics = vi.mocked(getMyCourseAnalytics);

describe('LearnerAnalyticsPanel', () => {
  beforeEach(() => {
    mockedGetMyCourseAnalytics.mockReset();
    mockedGetMyCourseAnalytics.mockResolvedValue(learnerAnalytics());
  });

  it('renders learner metrics and quiz attempt rows', async () => {
    renderPanel();

    expect(await screen.findByText('Assessment analytics')).toBeInTheDocument();
    expect(await screen.findByText('Frontend basics check')).toBeInTheDocument();
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    expect(screen.getByText('1 of 2 lessons')).toBeInTheDocument();
    expect(screen.getByText('Rank 2 of 3')).toBeInTheDocument();
    expect(mockedGetMyCourseAnalytics).toHaveBeenCalledWith('course-1');
  });
});

function renderPanel() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <LearnerAnalyticsPanel courseId="course-1" />
    </QueryClientProvider>,
  );
}

function learnerAnalytics(): LearnerCourseAnalyticsResponse {
  return {
    averageQuizScore: 10,
    bestQuizScore: 12,
    completedLessons: 1,
    completionPercent: 50,
    courseId: 'course-1',
    lastActivityAt: '2026-09-14T00:00:00.000Z',
    quizAttempts: [
      {
        correctCount: 1,
        finishedAt: '2026-09-14T00:00:00.000Z',
        lessonId: 'lesson-1',
        lessonTitle: 'Intro video',
        participantCount: 3,
        percentCorrect: 50,
        questionCount: 2,
        quizRunId: 'run-1',
        quizTitle: 'Frontend basics check',
        rank: 2,
        totalScore: 10,
      },
    ],
    quizRunsTaken: 1,
    totalLessons: 2,
  };
}
