import { CheckCircle2, Clock3, PlayCircle } from 'lucide-react';
import type { LessonProgressResponse } from '@lms/shared';
import { useQuery } from '@tanstack/react-query';
import { getMyCourseProgress } from '../../api/progress';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { Progress } from '../../components/ui/progress';
import { getErrorMessage } from '../../lib/errors';

type ProgressSummaryProps = {
  courseId: string;
};

export function ProgressSummary({ courseId }: ProgressSummaryProps) {
  const progressQuery = useQuery({
    queryKey: ['my-course-progress', courseId],
    queryFn: () => getMyCourseProgress(courseId),
  });

  return (
    <section className="panel course-progress-panel" aria-labelledby="learning-progress-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="learning-progress-title">
            Learning progress
          </h3>
          <p className="panel-subtitle">Your course activity</p>
        </div>
        <StatusBadge tone="success">{progressQuery.data?.percent ?? 0}%</StatusBadge>
      </div>
      <div className="panel-body panel-stack">
        {progressQuery.isLoading && <LoadingBlock height={220} label="Loading progress" />}
        {progressQuery.isError && (
          <p className="error-banner" role="alert">
            {getErrorMessage(progressQuery.error)}
          </p>
        )}
        {progressQuery.data && progressQuery.data.lessons.length === 0 && (
          <EmptyState
            description="Start a lesson video to build your progress history."
            title="No progress yet"
          />
        )}
        {progressQuery.data && progressQuery.data.lessons.length > 0 && (
          <>
            <div className="progress-overview">
              <div className="progress-score">
                <span>{progressQuery.data.percent}%</span>
                <strong>
                  {progressQuery.data.completedLessons} of {progressQuery.data.totalLessons}{' '}
                  completed
                </strong>
              </div>
              <Progress aria-label="Course completion" value={progressQuery.data.percent} />
            </div>
            <div className="lesson-progress-list">
              {progressQuery.data.lessons.map((lesson) => (
                <LessonProgressRow key={lesson.lessonId} lesson={lesson} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function LessonProgressRow({ lesson }: { lesson: LessonProgressResponse }) {
  const percent = getLessonPercent(lesson);
  const completed = Boolean(lesson.completedAt);
  const started = lesson.positionSeconds > 0;
  const tone = completed ? 'success' : started ? 'live' : 'muted';
  const label = completed ? 'Completed' : started ? 'In progress' : 'Not started';

  return (
    <article className="lesson-progress-row">
      <div className="lesson-progress-title">
        {completed ? (
          <CheckCircle2 size={16} aria-hidden="true" />
        ) : (
          <PlayCircle size={16} aria-hidden="true" />
        )}
        <strong>{lesson.title}</strong>
      </div>
      <span className="lesson-progress-time">
        <Clock3 size={15} aria-hidden="true" />
        {formatWatchTime(lesson.positionSeconds)} / {formatWatchTime(lesson.durationSeconds)}
      </span>
      <span className="lesson-progress-percent">{percent}% watched</span>
      <StatusBadge tone={tone}>{label}</StatusBadge>
    </article>
  );
}

function getLessonPercent(lesson: LessonProgressResponse): number {
  if (lesson.completedAt) {
    return 100;
  }

  if (lesson.durationSeconds <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((lesson.positionSeconds / lesson.durationSeconds) * 100));
}

function formatWatchTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}
