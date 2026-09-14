import { Download, GraduationCap, ListChecks, Target, UsersRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { downloadCourseAnalyticsCsv, getInstructorCourseAnalytics } from '../../api/analytics';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { getErrorMessage } from '../../lib/errors';
import { AnalyticsMetricCard } from './AnalyticsMetricCard';
import { formatDateTime, formatNumber, formatPercent } from './analytics-format';

type InstructorAnalyticsPanelProps = {
  courseId: string;
};

export function InstructorAnalyticsPanel({ courseId }: InstructorAnalyticsPanelProps) {
  const analyticsQuery = useQuery({
    queryKey: ['course-analytics', courseId],
    queryFn: () => getInstructorCourseAnalytics(courseId),
  });

  async function handleExport(kind: 'students' | 'questions') {
    const blob = await downloadCourseAnalyticsCsv(courseId, kind);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      kind === 'students' ? 'course-analytics-students.csv' : 'course-analytics-questions.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel analytics-panel" aria-labelledby="instructor-analytics-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="instructor-analytics-title">
            Course analytics
          </h3>
          <p className="panel-subtitle">Engagement, quiz quality, and learner outcomes</p>
        </div>
        <TooltipProvider>
          <div className="analytics-actions" aria-label="Analytics exports">
            <ExportButton
              label="Export student analytics"
              onClick={() => void handleExport('students')}
            />
            <ExportButton
              label="Export question analytics"
              onClick={() => void handleExport('questions')}
            />
          </div>
        </TooltipProvider>
      </div>
      <div className="panel-body panel-stack">
        {analyticsQuery.isLoading && <LoadingBlock height={320} label="Loading analytics" />}
        {analyticsQuery.isError && (
          <p className="error-banner" role="alert">
            {getErrorMessage(analyticsQuery.error)}
          </p>
        )}
        {analyticsQuery.data && analyticsQuery.data.totalStudents === 0 && (
          <EmptyState
            description="Analytics appear after students enroll, watch lessons, and answer quizzes."
            title="No analytics yet"
          />
        )}
        {analyticsQuery.data && analyticsQuery.data.totalStudents > 0 && (
          <>
            <div className="analytics-metric-grid">
              <AnalyticsMetricCard
                detail={`${analyticsQuery.data.activeStudents} active students`}
                icon={<UsersRound />}
                label="Students"
                value={formatNumber(analyticsQuery.data.totalStudents)}
              />
              <AnalyticsMetricCard
                detail={`${analyticsQuery.data.completedStudents} completed all lessons`}
                icon={<GraduationCap />}
                label="Completion"
                value={formatPercent(analyticsQuery.data.averageCompletionPercent)}
              />
              <AnalyticsMetricCard
                detail={`${formatPercent(analyticsQuery.data.quizParticipationRate)} participation`}
                icon={<Target />}
                label="Quiz score"
                value={formatNumber(analyticsQuery.data.averageQuizScore)}
              />
              <AnalyticsMetricCard
                detail={`${analyticsQuery.data.lessonCompletions.length} lessons tracked`}
                icon={<ListChecks />}
                label="Lesson signals"
                value={formatNumber(analyticsQuery.data.lessonCompletions.length)}
              />
            </div>
            <div className="analytics-two-column">
              <div className="analytics-subpanel">
                <h4>Lesson completion</h4>
                <div className="analytics-lesson-list">
                  {analyticsQuery.data.lessonCompletions.map((lesson) => (
                    <article className="analytics-lesson-row" key={lesson.lessonId}>
                      <div>
                        <strong>{lesson.lessonTitle}</strong>
                        <span>
                          {lesson.completedStudents} of {lesson.totalStudents} completed
                        </span>
                      </div>
                      <div className="analytics-inline-progress">
                        <Progress
                          aria-label={`${lesson.lessonTitle} completion`}
                          value={lesson.completionPercent}
                        />
                        <span>{formatPercent(lesson.completionPercent)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="analytics-subpanel">
                <h4>Question performance</h4>
                <div className="analytics-question-list">
                  {analyticsQuery.data.questionPerformance.map((question) => (
                    <article className="analytics-question-row" key={question.questionId}>
                      <div>
                        <strong>{question.questionText}</strong>
                        <span>{question.quizTitle}</span>
                      </div>
                      <StatusBadge tone={question.correctPercent >= 70 ? 'success' : 'live'}>
                        {formatPercent(question.correctPercent)}
                      </StatusBadge>
                    </article>
                  ))}
                </div>
              </div>
            </div>
            <div className="analytics-subpanel">
              <h4>Student summary</h4>
              <div className="analytics-student-table">
                <div className="analytics-student-row analytics-student-head">
                  <span>Student</span>
                  <span>Completion</span>
                  <span>Quiz runs</span>
                  <span>Average score</span>
                  <span>Last activity</span>
                </div>
                {analyticsQuery.data.studentSummaries.map((student) => (
                  <article className="analytics-student-row" key={student.userId}>
                    <div>
                      <strong>{student.name}</strong>
                      <span>{student.email}</span>
                    </div>
                    <StatusBadge tone={student.completionPercent >= 100 ? 'success' : 'muted'}>
                      {formatPercent(student.completionPercent)}
                    </StatusBadge>
                    <span>{formatNumber(student.quizRunsTaken)}</span>
                    <span>{formatNumber(student.averageQuizScore)}</span>
                    <span>{formatDateTime(student.lastActivityAt)}</span>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} onClick={onClick} size="icon" variant="ghost">
          <Download aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
