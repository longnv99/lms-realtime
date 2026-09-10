import { useEffect, useMemo } from 'react';
import { ArrowLeft, LockKeyhole, UserPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { ProgressUpdatedPayload } from '@lms/shared';
import { enrollCourse, getCourse } from '../../api/courses';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { listSessions } from '../../api/sessions';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { createNamespaceSocket } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
import { myEnrollmentsQueryKey, useMyEnrollmentIds } from '../enrollments/useMyEnrollmentIds';
import { LessonsPanel } from '../lessons/LessonsPanel';
import { InstructorProgressPanel } from '../progress/InstructorProgressPanel';
import { ProgressSummary } from '../progress/ProgressSummary';
import { SessionsPanel } from '../sessions/SessionsPanel';

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const courseQuery = useQuery({
    enabled: Boolean(courseId),
    queryKey: ['course', courseId],
    queryFn: () => getCourse(courseId ?? ''),
  });
  const course = courseQuery.data ?? null;
  const canManage = Boolean(course && (user?.role === 'ADMIN' || course.instructorId === user?.id));
  const isStudent = user?.role === 'STUDENT';
  const { enrolledCourseIds, enrollmentsQuery } = useMyEnrollmentIds(Boolean(course && isStudent));
  const enrollmentLoading = Boolean(course && isStudent && enrollmentsQuery.isLoading);
  const enrollmentError = isStudent ? enrollmentsQuery.error : null;
  const isEnrolled = Boolean(course && isStudent && enrolledCourseIds.has(course.id));
  const canStudy = Boolean(isStudent && isEnrolled);
  const studentAccessKnown = !isStudent || enrollmentsQuery.isSuccess || enrollmentsQuery.isError;
  const sessionsQuery = useQuery({
    enabled: Boolean(courseId && canManage && accessToken),
    queryKey: ['sessions', courseId],
    queryFn: () => listSessions(courseId ?? ''),
  });
  const liveSessionId = useMemo(
    () => sessionsQuery.data?.find((session) => session.status === 'LIVE')?.id ?? null,
    [sessionsQuery.data],
  );
  const enrollMutation = useMutation({
    mutationFn: enrollCourse,
    onSuccess: async (_, enrolledCourseId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myEnrollmentsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
        queryClient.invalidateQueries({ queryKey: ['my-course-progress', enrolledCourseId] }),
      ]);
    },
  });

  useEffect(() => {
    if (!accessToken || !courseId || !canManage || !liveSessionId) {
      return undefined;
    }

    const socket = createNamespaceSocket('/sessions', accessToken);
    const handleProgressUpdated = (payload: ProgressUpdatedPayload) => {
      if (payload.courseId !== courseId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['course-progress', courseId] });
      void queryClient.invalidateQueries({ queryKey: ['my-course-progress', courseId] });
    };

    socket.emit('session:join', { sessionId: liveSessionId });
    socket.on('progress:updated', handleProgressUpdated);

    return () => {
      socket.off('progress:updated', handleProgressUpdated);
      socket.disconnect();
    };
  }, [accessToken, canManage, courseId, liveSessionId, queryClient]);

  if (courseQuery.isLoading) {
    return (
      <div className="page">
        <LoadingBlock height={320} label="Loading course detail" />
      </div>
    );
  }

  if (courseQuery.isError || !course) {
    return (
      <div className="page">
        <p className="error-banner" role="alert">
          {getErrorMessage(courseQuery.error)}
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <Link className="button button-ghost detail-back" to="/courses">
        <ArrowLeft size={18} aria-hidden="true" />
        Courses
      </Link>
      <section className="detail-hero">
        <div className="detail-hero-copy">
          <StatusBadge tone={course.status === 'PUBLISHED' ? 'success' : 'muted'}>
            {course.status}
          </StatusBadge>
          <h2 className="page-title">{course.title}</h2>
          <p className="page-description">{course.description ?? course.slug}</p>
          {!canManage && canStudy && (
            <Link
              className="button button-primary detail-hero-action"
              to={`/courses/${course.id}/learn`}
            >
              Continue learning
            </Link>
          )}
          {!canManage && !canStudy && (
            <Button
              className="detail-hero-action"
              disabled={enrollmentLoading || Boolean(enrollmentError) || enrollMutation.isPending}
              icon={<UserPlus size={16} aria-hidden="true" />}
              onClick={() => enrollMutation.mutate(course.id)}
            >
              Enroll now
            </Button>
          )}
        </div>
        <dl className="detail-meta-grid" aria-label="Course metadata">
          <div>
            <dt>Slug</dt>
            <dd>{course.slug}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>{getAccessLabel({ canManage, canStudy, enrollmentLoading })}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(course.updatedAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>
      <section className="dashboard-grid course-detail-grid">
        {canManage ? (
          <InstructorProgressPanel courseId={course.id} />
        ) : canStudy ? (
          <ProgressSummary courseId={course.id} />
        ) : (
          <CourseAccessPanel
            enrollmentError={enrollmentError}
            enrollmentLoading={!studentAccessKnown || enrollmentLoading}
            enrollmentPending={enrollMutation.isPending}
            onEnroll={() => enrollMutation.mutate(course.id)}
          />
        )}
        <LessonsPanel
          canManage={canManage}
          courseId={course.id}
          isEnrolled={canManage || canStudy}
        />
        {canManage || canStudy ? (
          <SessionsPanel canManage={canManage} courseId={course.id} />
        ) : (
          <LockedPanel
            id="locked-live-sessions"
            description="Enrollment unlocks scheduled rooms and live class entry."
            title="Enroll to view live sessions"
          />
        )}
      </section>
    </div>
  );
}

function CourseAccessPanel({
  enrollmentError,
  enrollmentLoading,
  enrollmentPending,
  onEnroll,
}: {
  enrollmentError: Error | null;
  enrollmentLoading: boolean;
  enrollmentPending: boolean;
  onEnroll: () => void;
}) {
  return (
    <section className="panel course-access-panel" aria-labelledby="course-access-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="course-access-title">
            Course access
          </h3>
          <p className="panel-subtitle">Student enrollment</p>
        </div>
        <StatusBadge tone="muted">Preview</StatusBadge>
      </div>
      <div className="panel-body panel-stack">
        {enrollmentLoading ? (
          <LoadingBlock height={180} label="Checking enrollment" />
        ) : enrollmentError ? (
          <p className="error-banner" role="alert">
            {getErrorMessage(enrollmentError)}
          </p>
        ) : (
          <>
            <EmptyState
              description="Enrollment unlocks progress, live sessions, notes, transcripts, and quiz review."
              title="Enroll to start learning"
            />
            <Button
              disabled={enrollmentPending}
              icon={<UserPlus size={16} aria-hidden="true" />}
              onClick={onEnroll}
            >
              Enroll now
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function LockedPanel({
  description,
  id,
  title,
}: {
  description: string;
  id: string;
  title: string;
}) {
  return (
    <section className="panel course-access-panel" aria-labelledby={`${id}-title`}>
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id={`${id}-title`}>
            {title}
          </h3>
          <p className="panel-subtitle">Enrollment required</p>
        </div>
        <LockKeyhole size={18} aria-hidden="true" />
      </div>
      <div className="panel-body">
        <p className="course-access-description">{description}</p>
      </div>
    </section>
  );
}

function getAccessLabel({
  canManage,
  canStudy,
  enrollmentLoading,
}: {
  canManage: boolean;
  canStudy: boolean;
  enrollmentLoading: boolean;
}) {
  if (canManage) {
    return 'Manage';
  }

  if (enrollmentLoading) {
    return 'Checking';
  }

  return canStudy ? 'Enrolled' : 'Preview';
}
