import { Activity, UserRound } from 'lucide-react';
import type { InstructorCourseProgressStudentResponse } from '@lms/shared';
import { useQuery } from '@tanstack/react-query';
import { getCourseProgress } from '../../api/progress';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { Progress } from '../../components/ui/progress';
import { getErrorMessage } from '../../lib/errors';

type InstructorProgressPanelProps = {
  courseId: string;
};

export function InstructorProgressPanel({ courseId }: InstructorProgressPanelProps) {
  const progressQuery = useQuery({
    queryKey: ['course-progress', courseId],
    queryFn: () => getCourseProgress(courseId),
  });

  return (
    <section className="panel course-progress-panel" aria-labelledby="learner-progress-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="learner-progress-title">
            Learner progress
          </h3>
          <p className="panel-subtitle">Completion across enrolled students</p>
        </div>
        <StatusBadge>{progressQuery.data?.students.length ?? 0} learners</StatusBadge>
      </div>
      <div className="panel-body panel-stack">
        {progressQuery.isLoading && <LoadingBlock height={240} label="Loading learner progress" />}
        {progressQuery.isError && (
          <p className="error-banner" role="alert">
            {getErrorMessage(progressQuery.error)}
          </p>
        )}
        {progressQuery.data && progressQuery.data.students.length === 0 && (
          <EmptyState
            description="Progress appears here after students watch lesson videos."
            title="No learner activity"
          />
        )}
        {progressQuery.data && progressQuery.data.students.length > 0 && (
          <div className="instructor-progress-table">
            <div className="instructor-progress-row instructor-progress-head">
              <span>Student</span>
              <span>Completed</span>
              <span>Progress</span>
              <span>Last watched</span>
            </div>
            {progressQuery.data.students.map((student) => (
              <InstructorProgressRow
                key={student.userId}
                student={student}
                totalLessons={progressQuery.data.totalLessons}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function InstructorProgressRow({
  student,
  totalLessons,
}: {
  student: InstructorCourseProgressStudentResponse;
  totalLessons: number;
}) {
  return (
    <article className="instructor-progress-row">
      <div className="student-cell">
        <span className="student-avatar" aria-hidden="true">
          <UserRound size={16} />
        </span>
        <div>
          <strong>{student.name}</strong>
          <span>{student.email}</span>
        </div>
      </div>
      <strong className="completed-cell">
        {student.completedLessons} / {totalLessons}
      </strong>
      <div className="student-progress-cell">
        <Progress aria-label={`${student.name} completion`} value={student.percent} />
        <StatusBadge tone={student.percent >= 100 ? 'success' : student.percent > 0 ? 'live' : 'muted'}>
          {student.percent}%
        </StatusBadge>
      </div>
      <span className="last-watched-cell">
        <Activity size={15} aria-hidden="true" />
        {student.lastWatchedAt ? formatDateTime(student.lastWatchedAt) : 'No activity'}
      </span>
    </article>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
