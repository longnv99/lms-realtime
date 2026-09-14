import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstructorCourseAnalyticsResponse } from '@lms/shared';
import { downloadCourseAnalyticsCsv, getInstructorCourseAnalytics } from '../../api/analytics';
import { InstructorAnalyticsPanel } from './InstructorAnalyticsPanel';

vi.mock('../../api/analytics', () => ({
  downloadCourseAnalyticsCsv: vi.fn(),
  getInstructorCourseAnalytics: vi.fn(),
}));

const mockedDownloadCourseAnalyticsCsv = vi.mocked(downloadCourseAnalyticsCsv);
const mockedGetInstructorCourseAnalytics = vi.mocked(getInstructorCourseAnalytics);

describe('InstructorAnalyticsPanel', () => {
  beforeEach(() => {
    mockedDownloadCourseAnalyticsCsv.mockReset();
    mockedGetInstructorCourseAnalytics.mockReset();
    mockedGetInstructorCourseAnalytics.mockResolvedValue(instructorAnalytics());
  });

  it('renders instructor metrics, lesson completion, and student summaries', async () => {
    renderPanel();

    expect(await screen.findByText('Course analytics')).toBeInTheDocument();
    expect(await screen.findByText('Lesson completion')).toBeInTheDocument();
    expect(screen.getByText('2 active students')).toBeInTheDocument();
    expect(screen.getByText('Intro video')).toBeInTheDocument();
    expect(screen.getByText('Which tool renders React apps?')).toBeInTheDocument();
    expect(screen.getByText('Student One')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export student analytics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export question analytics' })).toBeInTheDocument();
  });
});

function renderPanel() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <InstructorAnalyticsPanel courseId="course-1" />
    </QueryClientProvider>,
  );
}

function instructorAnalytics(): InstructorCourseAnalyticsResponse {
  return {
    activeStudents: 2,
    averageCompletionPercent: 25,
    averageQuizScore: 15,
    completedStudents: 0,
    courseId: 'course-1',
    lessonCompletions: [
      {
        averagePositionSeconds: 60,
        completedStudents: 1,
        completionPercent: 50,
        lessonId: 'lesson-1',
        lessonTitle: 'Intro video',
        totalStudents: 2,
      },
    ],
    questionPerformance: [
      {
        answerCount: 2,
        correctCount: 2,
        correctPercent: 100,
        questionId: 'question-1',
        questionText: 'Which tool renders React apps?',
        quizId: 'quiz-1',
        quizRunId: 'run-1',
        quizTitle: 'Frontend basics check',
      },
    ],
    quizParticipationRate: 100,
    studentSummaries: [
      {
        averageQuizScore: 10,
        completedLessons: 1,
        completionPercent: 50,
        email: 'student.one@example.com',
        lastActivityAt: '2026-09-14T00:00:00.000Z',
        name: 'Student One',
        quizRunsTaken: 1,
        userId: 'student-1',
      },
    ],
    totalStudents: 2,
  };
}
