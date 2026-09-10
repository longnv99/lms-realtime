import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseQuizReviewResponse } from '@lms/shared';
import { getMyCourseQuizReviews } from '../../api/quizzes';
import { QuizReviewPanel } from './QuizReviewPanel';

vi.mock('../../api/quizzes', () => ({
  getMyCourseQuizReviews: vi.fn(),
}));

const mockedGetMyCourseQuizReviews = vi.mocked(getMyCourseQuizReviews);

describe('QuizReviewPanel', () => {
  beforeEach(() => {
    mockedGetMyCourseQuizReviews.mockReset();
    mockedGetMyCourseQuizReviews.mockResolvedValue(reviewsFixture());
  });

  it('renders review results, explanations, and lesson review action', async () => {
    const onSelectLesson = vi.fn();
    renderPanel(onSelectLesson);

    expect(await screen.findByText('Quiz review')).toBeInTheDocument();
    expect(screen.getByText('2 / 3 correct')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat events keep learner progress current')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Review lesson/i }));

    expect(onSelectLesson).toHaveBeenCalledWith('lesson-1');
  });
});

function renderPanel(onSelectLesson: (lessonId: string) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <QuizReviewPanel
        activeLessonId="lesson-1"
        courseId="course-1"
        onSelectLesson={onSelectLesson}
      />
    </QueryClientProvider>,
  );
}

function reviewsFixture(): CourseQuizReviewResponse {
  return {
    courseId: 'course-1',
    reviews: [
      {
        correctCount: 2,
        finishedAt: '2026-09-09T09:20:00.000Z',
        lessonId: 'lesson-1',
        lessonTitle: 'Lesson 1: Intro lesson',
        questionCount: 3,
        questions: [
          {
            correctOptionId: 'option-a',
            explanation: 'Heartbeat events keep learner progress current',
            isCorrect: true,
            options: [
              { id: 'option-a', text: 'Heartbeat' },
              { id: 'option-b', text: 'Manual refresh' },
            ],
            order: 1,
            questionId: 'question-1',
            score: 1,
            selectedOptionId: 'option-a',
            text: 'Which event keeps progress fresh?',
          },
        ],
        quizId: 'quiz-1',
        quizRunId: 'run-1',
        quizTitle: 'Progress checkpoint',
        startedAt: '2026-09-09T09:10:00.000Z',
        status: 'FINISHED',
        totalScore: 2,
      },
    ],
  };
}
