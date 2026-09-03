import { BookOpenCheck, CheckCircle2, Eye, FileClock, Filter, Send } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { CourseResponse, CourseStatus } from '@lms/shared';
import { enrollCourse, listCourses, publishCourse } from '../../api/courses';
import { EmptyState } from '../../components/EmptyState';
import { Field } from '../../components/Field';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
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
  const courses = coursesQuery.data ?? [];

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
      <CourseOverviewCards
        courses={courses}
        isInstructor={isInstructor}
        isLoading={coursesQuery.isLoading}
      />
      <section className="course-layout">
        <div className="course-main">
          <CourseList
            courses={courses}
            error={coursesQuery.error}
            isInstructor={isInstructor}
            isLoading={coursesQuery.isLoading}
          />
        </div>
        <aside className="course-side" aria-label="Course controls">
          <section className="panel filter-panel" aria-label="Course filters">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Filters</h3>
                <p className="panel-subtitle">Refine the course table</p>
              </div>
              <Filter size={18} aria-hidden="true" />
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
                <Select
                  onValueChange={(value) =>
                    setStatus(value === 'ALL' ? '' : (value as CourseStatus))
                  }
                  value={status || 'ALL'}
                >
                  <SelectTrigger
                    aria-label="Course status"
                    className="field-control"
                    id="course-status"
                  >
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          </section>
          {isInstructor && <CourseEditorPanel />}
        </aside>
      </section>
    </div>
  );
}

function CourseOverviewCards({
  courses,
  isInstructor,
  isLoading,
}: {
  courses: CourseResponse[];
  isInstructor: boolean;
  isLoading: boolean;
}) {
  const published = courses.filter((course) => course.status === 'PUBLISHED').length;
  const drafts = courses.filter((course) => course.status === 'DRAFT').length;

  return (
    <section className="section-cards" aria-label="Course overview">
      <article className="metric-card">
        <div className="metric-card-icon">
          <BookOpenCheck size={18} aria-hidden="true" />
        </div>
        <div>
          <span>Total courses</span>
          <strong>{isLoading ? '...' : courses.length}</strong>
        </div>
      </article>
      <article className="metric-card">
        <div className="metric-card-icon">
          <CheckCircle2 size={18} aria-hidden="true" />
        </div>
        <div>
          <span>Published</span>
          <strong>{isLoading ? '...' : published}</strong>
        </div>
      </article>
      <article className="metric-card">
        <div className="metric-card-icon">
          <FileClock size={18} aria-hidden="true" />
        </div>
        <div>
          <span>{isInstructor ? 'Drafts' : 'Available'}</span>
          <strong>{isLoading ? '...' : isInstructor ? drafts : published}</strong>
        </div>
      </article>
    </section>
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
          title="No courses yet"
        />
      </div>
    );
  }

  return (
    <section className="panel course-table" aria-label="Course list">
      <div className="panel-header table-panel-header">
        <div>
          <h3 className="panel-title">Course catalog</h3>
          <p className="panel-subtitle">{formatResultCount(courses.length)}</p>
        </div>
        <StatusBadge>{isInstructor ? 'Instructor view' : 'Student view'}</StatusBadge>
      </div>
      <div className="course-table-body">
        <div className="course-row course-row-head">
          <span>Course</span>
          <span>State</span>
          <span>Last changed</span>
          <span>Actions</span>
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
      </div>
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
        {course.description && <span className="course-description">{course.description}</span>}
        <code className="course-slug">{course.slug}</code>
      </div>
      <StatusBadge tone={getCourseStatusTone(course.status)}>
        {formatCourseStatus(course.status)}
      </StatusBadge>
      <div className="course-updated-cell">
        <time dateTime={course.updatedAt}>{formatCourseDate(course.updatedAt)}</time>
        <span>{getCourseStateDescription(course.status)}</span>
      </div>
      <div className="course-actions" aria-label={`Actions for ${course.title}`}>
        {isInstructor && course.status !== 'PUBLISHED' && (
          <button
            aria-label={`Publish ${course.title}`}
            className="course-action"
            disabled={publishPending}
            onClick={onPublish}
            title="Publish"
            type="button"
          >
            <Send size={18} aria-hidden="true" />
            <span className="sr-only">Publish</span>
            <span className="tooltip-label" role="tooltip">
              Publish
            </span>
          </button>
        )}
        {!isInstructor && course.status === 'PUBLISHED' && (
          <button
            aria-label={`Enroll in ${course.title}`}
            className="course-action"
            disabled={enrollPending}
            onClick={onEnroll}
            title="Enroll"
            type="button"
          >
            <CheckCircle2 size={18} aria-hidden="true" />
            <span className="sr-only">Enroll</span>
            <span className="tooltip-label" role="tooltip">
              Enroll
            </span>
          </button>
        )}
        <Link
          aria-label={`Open details for ${course.title}`}
          className="course-action"
          title="Details"
          to={`/courses/${course.id}`}
        >
          <Eye size={18} aria-hidden="true" />
          <span className="sr-only">Details</span>
          <span className="tooltip-label" role="tooltip">
            Details
          </span>
        </Link>
      </div>
    </article>
  );
}

function formatResultCount(count: number) {
  return count === 1 ? '1 course shown' : `${count} courses shown`;
}

function getCourseStatusTone(status: CourseStatus): 'live' | 'muted' | 'success' {
  if (status === 'PUBLISHED') {
    return 'success';
  }

  return 'muted';
}

function formatCourseStatus(status: CourseStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function getCourseStateDescription(status: CourseStatus) {
  if (status === 'PUBLISHED') {
    return 'Published course';
  }

  if (status === 'ARCHIVED') {
    return 'Archived record';
  }

  return 'Draft workspace';
}

function formatCourseDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function useCourseFilter<T>(initialValue: T) {
  return useState(initialValue);
}
