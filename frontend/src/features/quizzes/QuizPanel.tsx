import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import type {
  QuizFinishedPayload,
  QuizLeaderboardEntry,
  QuizLeaderboardPayload,
  QuizQuestionClosedPayload,
  QuizQuestionPayload,
  QuizRevealPayload,
  QuizRunStatus,
} from '@lms/shared';
import { getQuizRunState, listQuizRuns } from '../../api/quizzes';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { createNamespaceSocket, useSocketStatus } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
import { LeaderboardPanel } from './LeaderboardPanel';
import { QuizInstructorControls } from './QuizInstructorControls';
import { QuizStudentAnswerGrid } from './QuizStudentAnswerGrid';

type QuizPanelProps = {
  sessionId: string;
};

export function QuizPanel({ sessionId }: QuizPanelProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [questionState, setQuestionState] = useState<QuizQuestionPayload | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [answerCount, setAnswerCount] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [finishedSummaryUrl, setFinishedSummaryUrl] = useState<string | null>(null);
  const socketStatus = useSocketStatus(socket);

  const runsQuery = useQuery({
    queryKey: ['quiz-runs', sessionId],
    queryFn: () => listQuizRuns(sessionId),
  });
  const quizRun = runsQuery.data?.[0] ?? null;
  const stateQuery = useQuery({
    enabled: Boolean(quizRun?.id),
    queryKey: ['quiz-run-state', quizRun?.id],
    queryFn: () => getQuizRunState(quizRun?.id ?? ''),
  });

  useEffect(() => {
    if (!stateQuery.data?.question) {
      return;
    }

    setQuestionState({
      currentQuestionIndex: stateQuery.data.currentQuestionIndex ?? 0,
      question: stateQuery.data.question,
    });
  }, [stateQuery.data]);

  useEffect(() => {
    if (!accessToken || !quizRun?.id) {
      return undefined;
    }

    const nextSocket = createNamespaceSocket('/quiz', accessToken);
    const handleQuestion = (payload: QuizQuestionPayload) => {
      setQuestionState(payload);
      setSelectedOptionId(null);
      setCorrectOptionId(null);
      setAnswerCount(null);
      setFinishedSummaryUrl(null);
    };
    const handleClosed = (payload: QuizQuestionClosedPayload) => {
      setAnswerCount(payload.answerCount);
    };
    const handleReveal = (payload: QuizRevealPayload) => {
      setCorrectOptionId(payload.correctOptionId);
      setAnswerCount(payload.correctCount);
    };
    const handleLeaderboard = (payload: QuizLeaderboardPayload) => {
      setLeaderboard(payload.entries);
    };
    const handleFinished = (payload: QuizFinishedPayload) => {
      setFinishedSummaryUrl(payload.summaryUrl);
    };

    setSocket(nextSocket);
    nextSocket.emit('quiz:join', { quizRunId: quizRun.id });
    nextSocket.on('quiz:question', handleQuestion);
    nextSocket.on('quiz:question:closed', handleClosed);
    nextSocket.on('quiz:reveal', handleReveal);
    nextSocket.on('quiz:leaderboard', handleLeaderboard);
    nextSocket.on('quiz:finished', handleFinished);

    return () => {
      nextSocket.off('quiz:question', handleQuestion);
      nextSocket.off('quiz:question:closed', handleClosed);
      nextSocket.off('quiz:reveal', handleReveal);
      nextSocket.off('quiz:leaderboard', handleLeaderboard);
      nextSocket.off('quiz:finished', handleFinished);
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [accessToken, quizRun?.id]);

  const status = useMemo<QuizRunStatus>(
    () =>
      finishedSummaryUrl ? 'FINISHED' : (stateQuery.data?.status ?? quizRun?.status ?? 'PENDING'),
    [finishedSummaryUrl, quizRun?.status, stateQuery.data?.status],
  );
  const canManage = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';
  const isQuestionLocked =
    Boolean(selectedOptionId) ||
    status === 'CLOSED' ||
    status === 'REVEALED' ||
    status === 'FINISHED';

  function handleAnswer(optionId: string) {
    if (!socket || !quizRun || !questionState || selectedOptionId) {
      return;
    }

    setSelectedOptionId(optionId);
    socket.emit('quiz:answer', {
      optionId,
      questionId: questionState.question.id,
      quizRunId: quizRun.id,
    });
  }

  if (runsQuery.isLoading) {
    return (
      <section className="panel quiz-panel" aria-labelledby="quiz-panel-title">
        <div className="panel-header">
          <h3 className="panel-title" id="quiz-panel-title">
            Quiz
          </h3>
        </div>
        <div className="panel-body">
          <LoadingBlock height={180} label="Loading quiz" />
        </div>
      </section>
    );
  }

  if (runsQuery.isError || stateQuery.isError) {
    return (
      <section className="panel quiz-panel" aria-labelledby="quiz-panel-title">
        <div className="panel-header">
          <h3 className="panel-title" id="quiz-panel-title">
            Quiz
          </h3>
        </div>
        <div className="panel-body">
          <p className="error-banner" role="alert">
            {getErrorMessage(runsQuery.error ?? stateQuery.error)}
          </p>
        </div>
      </section>
    );
  }

  if (!quizRun) {
    return (
      <section className="panel quiz-panel" aria-labelledby="quiz-panel-title">
        <div className="panel-header">
          <h3 className="panel-title" id="quiz-panel-title">
            Quiz
          </h3>
        </div>
        <div className="panel-body">
          <EmptyState description="No quiz run" title="Standby" />
        </div>
      </section>
    );
  }

  return (
    <section className="panel quiz-panel" aria-labelledby="quiz-panel-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="quiz-panel-title">
            {quizRun.quiz.title}
          </h3>
          <p className="panel-subtitle">
            {socketStatus === 'connected' ? 'Quiz connected' : 'Quiz offline'}
          </p>
        </div>
        <StatusBadge
          tone={status === 'OPEN' ? 'live' : status === 'FINISHED' ? 'success' : 'muted'}
        >
          {status}
        </StatusBadge>
      </div>
      <div className="panel-body quiz-stack">
        {questionState ? (
          <QuizStudentAnswerGrid
            correctOptionId={correctOptionId}
            isLocked={isQuestionLocked}
            onAnswer={(option) => handleAnswer(option.id)}
            question={questionState.question}
            selectedOptionId={selectedOptionId}
          />
        ) : (
          <EmptyState description="No active question" title="Waiting" />
        )}
        {answerCount !== null && <p className="quiz-count">{answerCount} answers</p>}
        {canManage && <QuizInstructorControls quizRunId={quizRun.id} />}
        <LeaderboardPanel entries={leaderboard} />
      </div>
    </section>
  );
}
