import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  QuizLeaderboardPayload,
  QuizQuestionPayload,
  QuizRevealPayload,
  QuizRunListItemResponse,
} from '@lms/shared';
import {
  closeQuestion,
  finishQuizRun,
  getQuizRunState,
  listQuizRuns,
  openNextQuestion,
  revealQuestion,
} from '../../api/quizzes';
import { createNamespaceSocket } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
import { QuizPanel } from './QuizPanel';

type SocketHandler = (payload: unknown) => void;
type MockedQuizSocket = {
  disconnect: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  on: (event: string, handler: SocketHandler) => MockedQuizSocket;
};

const socketHandlers = new Map<string, SocketHandler>();
const onMock = vi.fn((event: string, handler: SocketHandler): MockedQuizSocket => {
  socketHandlers.set(event, handler);
  return mockedSocket;
});
const mockedSocket: MockedQuizSocket = {
  disconnect: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  on: onMock,
};

vi.mock('../../api/quizzes', () => ({
  closeQuestion: vi.fn(),
  finishQuizRun: vi.fn(),
  getQuizRunState: vi.fn(),
  listQuizRuns: vi.fn(),
  openNextQuestion: vi.fn(),
  revealQuestion: vi.fn(),
}));

vi.mock('../../lib/realtime', () => ({
  createNamespaceSocket: vi.fn(() => mockedSocket),
  useSocketStatus: vi.fn(() => 'connected'),
}));

const mockedCloseQuestion = vi.mocked(closeQuestion);
const mockedCreateNamespaceSocket = vi.mocked(createNamespaceSocket);
const mockedFinishQuizRun = vi.mocked(finishQuizRun);
const mockedGetQuizRunState = vi.mocked(getQuizRunState);
const mockedListQuizRuns = vi.mocked(listQuizRuns);
const mockedOpenNextQuestion = vi.mocked(openNextQuestion);
const mockedRevealQuestion = vi.mocked(revealQuestion);

describe('QuizPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    socketHandlers.clear();
    mockedSocket.disconnect.mockClear();
    mockedSocket.emit.mockClear();
    mockedSocket.off.mockClear();
    onMock.mockClear();
    mockedCloseQuestion.mockReset();
    mockedCreateNamespaceSocket.mockClear();
    mockedFinishQuizRun.mockReset();
    mockedGetQuizRunState.mockReset();
    mockedListQuizRuns.mockReset();
    mockedOpenNextQuestion.mockReset();
    mockedRevealQuestion.mockReset();
    mockedListQuizRuns.mockResolvedValue([quizRun()]);
    mockedGetQuizRunState.mockResolvedValue({
      currentQuestionIndex: null,
      id: 'run-1',
      question: null,
      status: 'PENDING',
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

  it('joins a quiz run, submits one answer, reveals feedback, and renders leaderboard order', async () => {
    renderQuizPanel();

    expect(await screen.findByText('Intro quiz')).toBeInTheDocument();
    expect(mockedCreateNamespaceSocket).toHaveBeenCalledWith('/quiz', 'access-token');
    expect(mockedSocket.emit).toHaveBeenCalledWith('quiz:join', { quizRunId: 'run-1' });

    act(() => {
      socketHandlers.get('quiz:question')?.({
        currentQuestionIndex: 1,
        question: {
          id: 'question-1',
          options: [
            { id: 'a', text: 'PostgreSQL' },
            { id: 'b', text: 'Redis' },
          ],
          text: 'Which service stores relational LMS data?',
        },
      } satisfies QuizQuestionPayload);
    });

    expect(screen.getByText('Which service stores relational LMS data?')).toBeInTheDocument();
    expect(screen.queryByText('correctOptionId')).not.toBeInTheDocument();

    const answerButton = screen.getByRole('button', { name: /postgresql/i });
    await userEvent.click(answerButton);
    await userEvent.click(answerButton);

    expect(mockedSocket.emit).toHaveBeenCalledTimes(2);
    expect(mockedSocket.emit).toHaveBeenLastCalledWith('quiz:answer', {
      optionId: 'a',
      questionId: 'question-1',
      quizRunId: 'run-1',
    });
    expect(answerButton).toBeDisabled();

    act(() => {
      socketHandlers.get('quiz:reveal')?.({
        correctCount: 1,
        correctOptionId: 'a',
        questionId: 'question-1',
      } satisfies QuizRevealPayload);
      socketHandlers.get('quiz:leaderboard')?.({
        entries: [
          { name: 'Student B', rank: 2, score: 20, userId: 'student-b' },
          { name: 'Student A', rank: 1, score: 50, userId: 'student-a' },
        ],
      } satisfies QuizLeaderboardPayload);
    });

    expect(screen.getByText('Correct')).toBeInTheDocument();
    const rows = screen.getAllByTestId('leaderboard-row');
    expect(rows.map((row) => row.textContent)).toEqual(['1Student A50', '2Student B20']);
  });

  it('renders instructor controls and calls quiz run mutations', async () => {
    useAuthStore.setState({
      user: {
        email: 'instructor@example.com',
        id: 'instructor-1',
        name: 'Instructor',
        role: 'INSTRUCTOR',
      },
    });
    mockedOpenNextQuestion.mockResolvedValue({
      ...quizRunMutationResponse(),
      currentQuestionIndex: 1,
      question: quizQuestion().question,
    });
    mockedCloseQuestion.mockResolvedValue({
      ...quizRunMutationResponse(),
      answerCount: 0,
      questionId: 'question-1',
    });
    mockedRevealQuestion.mockResolvedValue({
      ...quizRunMutationResponse(),
      correctCount: 0,
      correctOptionId: 'a',
      questionId: 'question-1',
    });
    mockedFinishQuizRun.mockResolvedValue(quizRunMutationResponse({ status: 'FINISHED' }));

    renderQuizPanel();

    await userEvent.click(await screen.findByRole('button', { name: /mo cau tiep/i }));
    await userEvent.click(screen.getByRole('button', { name: /dong cau/i }));
    await userEvent.click(screen.getByRole('button', { name: /reveal/i }));
    await userEvent.click(screen.getByRole('button', { name: /ket thuc/i }));

    expect(mockedOpenNextQuestion).toHaveBeenCalledWith('run-1');
    expect(mockedCloseQuestion).toHaveBeenCalledWith('run-1');
    expect(mockedRevealQuestion).toHaveBeenCalledWith('run-1');
    expect(mockedFinishQuizRun).toHaveBeenCalledWith('run-1');
  });
});

function renderQuizPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <QuizPanel sessionId="session-1" />
    </QueryClientProvider>,
  );
}

function quizRun(overrides: Partial<QuizRunListItemResponse> = {}): QuizRunListItemResponse {
  return {
    createdAt: '2026-08-28T00:00:00.000Z',
    currentQuestionIndex: null,
    id: 'run-1',
    questionOpenedAt: null,
    quiz: { id: 'quiz-1', title: 'Intro quiz' },
    quizId: 'quiz-1',
    sessionId: 'session-1',
    status: 'PENDING',
    updatedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}

function quizRunMutationResponse(overrides: Partial<QuizRunListItemResponse> = {}) {
  return quizRun(overrides);
}

function quizQuestion(): QuizQuestionPayload {
  return {
    currentQuestionIndex: 1,
    question: {
      id: 'question-1',
      options: [
        { id: 'a', text: 'PostgreSQL' },
        { id: 'b', text: 'Redis' },
      ],
      text: 'Which service stores relational LMS data?',
    },
  };
}
