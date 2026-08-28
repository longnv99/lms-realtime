import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getCourse } from '../../api/courses';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { useAuthStore } from '../auth/auth.store';
import { LessonsPanel } from '../lessons/LessonsPanel';
import { SessionsPanel } from '../sessions/SessionsPanel';

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const user = useAuthStore((state) => state.user);
  const courseQuery = useQuery({
    enabled: Boolean(courseId),
    queryKey: ['course', courseId],
    queryFn: () => getCourse(courseId ?? ''),
  });

  if (courseQuery.isLoading) {
    return (
      <div className="page">
        <LoadingBlock height={320} label="Loading course detail" />
      </div>
    );
  }

  if (courseQuery.isError || !courseQuery.data) {
    return (
      <div className="page">
        <p className="error-banner" role="alert">
          {getErrorMessage(courseQuery.error)}
        </p>
      </div>
    );
  }

  const course = courseQuery.data;
  const canManage = user?.role === 'ADMIN' || course.instructorId === user?.id;

  return (
    <div className="page">
      <Link className="button button-ghost detail-back" to="/courses">
        <ArrowLeft size={18} aria-hidden="true" />
        Courses
      </Link>
      <section className="page-header">
        <StatusBadge tone={course.status === 'PUBLISHED' ? 'success' : 'muted'}>
          {course.status}
        </StatusBadge>
        <h2 className="page-title">{course.title}</h2>
        <p className="page-description">{course.description ?? course.slug}</p>
      </section>
      <section className="dashboard-grid">
        <LessonsPanel canManage={canManage} courseId={course.id} />
        <SessionsPanel canManage={canManage} courseId={course.id} />
      </section>
    </div>
  );
}
