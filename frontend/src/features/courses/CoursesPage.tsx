import { ArrowRight, CheckCircle2, Eye, Send } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { CourseResponse, CourseStatus } from '@lms/shared';
import { enrollCourse, listCourses, publishCourse } from '../../api/courses';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Field } from '../../components/Field';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { useAuthStore } from '../auth/auth.store';
import { CourseEditorPanel } from './CourseEditorPanel';

export function CoursesPage() {
  const user = useAuthStore((state) => state.user);
  const [keyword, setKeyword] = useCourseFilter('');
  const [status, setStatus] = useCourseFilter<CourseStatus | ''>('');
  const coursesQuery = useQuery({
    queryKey: ['courses', { keyword, status }],
    queryFn: () =>
      listCourses({
        keyword: keyword || undefined,
        status: status || undefined,
      }),
  });

  const isInstructor = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  return (
    <div className="page">
      <section className="page-header">
        <StatusBadge>Course operations</StatusBadge>
        <h2 className="page-title">Courses</h2>
        <p className="page-description">
          Browse published classes, prepare drafts, and open the live classroom from one compact
          workspace.
        </p>
      </section>
      <section className="course-layout">
        <aside className="panel filter-panel" aria-label="Course filters">
          <div className="panel-header">
            <h3 className="panel-title">Filters</h3>
          </div>
          <div className="panel-body auth-form">
            <Field
              label="Keyword"
              name="course-keyword"
              onChange={(event) => setKeyword(event.target.value)}
              value={keyword}
            />
            <label className="field" htmlFor="course-status">
              <span className="field-label">Status</span>
              <select
                className="field-control"
                id="course-status"
                onChange={(event) => setStatus(event.target.value as CourseStatus | '')}
                value={status}
              >
                <option value="">All</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
          </div>
        </aside>
        <div className="course-main">
          {isInstructor && <CourseEditorPanel />}
          <CourseList
            courses={coursesQuery.data ?? []}
            error={coursesQuery.error}
            isInstructor={isInstructor}
            isLoading={coursesQuery.isLoading}
          />
        </div>
      </section>
    </div>
  );
}

function CourseList({
  courses,
  error,
  isInstructor,
  isLoading,
}: {
  courses: CourseResponse[];
  error: Error | null;
  isInstructor: boolean;
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const enrollMutation = useMutation({
    mutationFn: enrollCourse,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });
  const publishMutation = useMutation({
    mutationFn: publishCourse,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });

  if (isLoading) {
    return <LoadingBlock height={280} label="Loading courses" />;
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-body">
          <p className="error-banner" role="alert">
            {getErrorMessage(error)}
          </p>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="panel">
        <EmptyState
          description="Create an instructor draft or seed the database to see local demo courses."
          title="Chua co khoa hoc"
        />
      </div>
    );
  }

  return (
    <section className="panel course-table" aria-label="Course list">
      <div className="course-row course-row-head">
        <span>Course</span>
        <span>Status</span>
        <span>Updated</span>
        <span>Action</span>
      </div>
      {courses.map((course) => (
        <CourseRow
          course={course}
          enrollPending={enrollMutation.isPending}
          isInstructor={isInstructor}
          key={course.id}
          onEnroll={() => enrollMutation.mutate(course.id)}
          onPublish={() => publishMutation.mutate(course.id)}
          publishPending={publishMutation.isPending}
        />
      ))}
    </section>
  );
}

function CourseRow({
  course,
  enrollPending,
  isInstructor,
  onEnroll,
  onPublish,
  publishPending,
}: {
  course: CourseResponse;
  enrollPending: boolean;
  isInstructor: boolean;
  onEnroll: () => void;
  onPublish: () => void;
  publishPending: boolean;
}) {
  return (
    <article className="course-row">
      <div className="course-title-cell">
        <strong>{course.title}</strong>
        <span>{course.slug}</span>
      </div>
      <StatusBadge tone={course.status === 'PUBLISHED' ? 'success' : 'muted'}>
        {course.status}
      </StatusBadge>
      <time dateTime={course.updatedAt}>{new Date(course.updatedAt).toLocaleDateString()}</time>
      <div className="toolbar">
        <Link className="button button-secondary" to={`/courses/${course.id}`}>
          <Eye size={18} aria-hidden="true" />
          View
        </Link>
        {isInstructor && course.status !== 'PUBLISHED' && (
          <Button
            disabled={publishPending}
            icon={<Send size={18} />}
            onClick={onPublish}
            variant="secondary"
          >
            Publish
          </Button>
        )}
        {!isInstructor && course.status === 'PUBLISHED' && (
          <Button disabled={enrollPending} icon={<CheckCircle2 size={18} />} onClick={onEnroll}>
            Ghi danh
          </Button>
        )}
        <ArrowRight size={18} aria-hidden="true" />
      </div>
    </article>
  );
}

function useCourseFilter<T>(initialValue: T) {
  return useState(initialValue);
}
