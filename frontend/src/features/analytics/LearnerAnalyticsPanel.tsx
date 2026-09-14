import { Award, BarChart3, Clock3, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMyCourseAnalytics } from '../../api/analytics';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { Progress } from '../../components/ui/progress';
import { getErrorMessage } from '../../lib/errors';
import { AnalyticsMetricCard } from './AnalyticsMetricCard';
import { formatDateTime, formatNumber, formatPercent } from './analytics-format';

type LearnerAnalyticsPanelProps = {
  courseId: string;
};

export function LearnerAnalyticsPanel({ courseId }: LearnerAnalyticsPanelProps) {
  const analyticsQuery = useQuery({
    queryKey: ['my-course-analytics', courseId],
    queryFn: () => getMyCourseAnalytics(courseId),
  });

  return (
    <section className="panel analytics-panel" aria-labelledby="learner-analytics-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="learner-analytics-title">
            Assessment analytics
          </h3>
          <p className="panel-subtitle">Quiz results and study activity</p>
        </div>
        <StatusBadge tone="live">
          {analyticsQuery.data ? formatPercent(analyticsQuery.data.completionPercent) : 'Loading'}
        </StatusBadge>
      </div>
      <div className="panel-body panel-stack">
        {analyticsQuery.isLoading && <LoadingBlock height={260} label="Loading analytics" />}
        {analyticsQuery.isError && (
          <p className="error-banner" role="alert">
            {getErrorMessage(analyticsQuery.error)}
          </p>
        )}
        {analyticsQuery.data && (
          <>
            <div className="analytics-metric-grid">
              <AnalyticsMetricCard
                detail={`${analyticsQuery.data.completedLessons} of ${analyticsQuery.data.totalLessons} lessons`}
                icon={<BarChart3 />}
                label="Completion"
                value={formatPercent(analyticsQuery.data.completionPercent)}
              />
              <AnalyticsMetricCard
                detail={`${analyticsQuery.data.quizRunsTaken} finished runs`}
                icon={<Award />}
                label="Average score"
                value={formatNumber(analyticsQuery.data.averageQuizScore)}
              />
              <AnalyticsMetricCard
                detail="Best finished quiz"
                icon={<Trophy />}
                label="Best score"
                value={formatNumber(analyticsQuery.data.bestQuizScore)}
              />
              <AnalyticsMetricCard
                detail={formatDateTime(analyticsQuery.data.lastActivityAt)}
                icon={<Clock3 />}
                label="Last activity"
                value={analyticsQuery.data.lastActivityAt ? 'Active' : 'Idle'}
              />
            </div>
            {analyticsQuery.data.quizAttempts.length === 0 ? (
              <EmptyState
                description="Finished live quizzes will appear here after you answer them."
                title="No quiz attempts yet"
              />
            ) : (
              <div className="analytics-attempt-list">
                {analyticsQuery.data.quizAttempts.map((attempt) => (
                  <article className="analytics-attempt-row" key={attempt.quizRunId}>
                    <div>
                      <strong>{attempt.quizTitle}</strong>
                      <span>{attempt.lessonTitle}</span>
                    </div>
                    <div className="analytics-inline-progress">
                      <Progress
                        aria-label={`${attempt.quizTitle} correct answers`}
                        value={attempt.percentCorrect}
                      />
                      <span>{formatPercent(attempt.percentCorrect)}</span>
                    </div>
                    <span>
                      {attempt.correctCount} / {attempt.questionCount} correct
                    </span>
                    <StatusBadge tone={attempt.rank === 1 ? 'success' : 'muted'}>
                      Rank {attempt.rank ?? '-'} of {attempt.participantCount}
                    </StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
