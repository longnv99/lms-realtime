import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getCourse } from '../../api/courses';
import { listLessons } from '../../api/lessons';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const courseQuery = useQuery({
    enabled: Boolean(courseId),
    queryKey: ['course', courseId],
    queryFn: () => getCourse(courseId ?? ''),
  });
  const lessonsQuery = useQuery({
    enabled: Boolean(courseId),
    queryKey: ['lessons', courseId],
    queryFn: () => listLessons(courseId ?? ''),
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
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Lessons</h3>
            <StatusBadge>{lessonsQuery.data?.length ?? 0}</StatusBadge>
          </div>
          <div className="panel-body">
            {lessonsQuery.isLoading ? (
              <LoadingBlock height={180} label="Loading lessons" />
            ) : (
              <EmptyState
                description="Lesson authoring and session controls are implemented in the next P4a task."
                title="Lesson workspace"
              />
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Live sessions</h3>
          </div>
          <div className="panel-body">
            <EmptyState
              description="Live session entry appears here after the sessions panel lands."
              title="No live room selected"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
