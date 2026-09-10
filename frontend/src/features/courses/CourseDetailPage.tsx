import { useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { ProgressUpdatedPayload } from '@lms/shared';
import { getCourse } from '../../api/courses';
import { listSessions } from '../../api/sessions';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { createNamespaceSocket } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
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
  const sessionsQuery = useQuery({
    enabled: Boolean(courseId && canManage && accessToken),
    queryKey: ['sessions', courseId],
    queryFn: () => listSessions(courseId ?? ''),
  });
  const liveSessionId = useMemo(
    () => sessionsQuery.data?.find((session) => session.status === 'LIVE')?.id ?? null,
    [sessionsQuery.data],
  );

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
          {!canManage && (
            <Link
              className="button button-primary detail-hero-action"
              to={`/courses/${course.id}/learn`}
            >
              Continue learning
            </Link>
          )}
        </div>
        <dl className="detail-meta-grid" aria-label="Course metadata">
          <div>
            <dt>Slug</dt>
            <dd>{course.slug}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>{canManage ? 'Manage' : 'Learn'}</dd>
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
        ) : (
          <ProgressSummary courseId={course.id} />
        )}
        <LessonsPanel canManage={canManage} courseId={course.id} />
        <SessionsPanel canManage={canManage} courseId={course.id} />
      </section>
    </div>
  );
}
