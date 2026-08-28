import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus } from 'lucide-react';
import type { LessonResponse } from '@lms/shared';
import { createLesson, listLessons } from '../../api/lessons';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Field } from '../../components/Field';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';

type LessonsPanelProps = {
  canManage: boolean;
  courseId: string;
};

export function LessonsPanel({ canManage, courseId }: LessonsPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('15');

  const lessonsQuery = useQuery({
    queryKey: ['lessons', courseId],
    queryFn: () => listLessons(courseId),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createLesson(courseId, {
        description: description.trim() || undefined,
        durationSeconds: Math.max(Number(durationMinutes) || 0, 0) * 60,
        title: title.trim(),
      }),
    onSuccess: async () => {
      setTitle('');
      setDescription('');
      setDurationMinutes('15');
      await queryClient.invalidateQueries({ queryKey: ['lessons', courseId] });
    },
  });

  const sortedLessons = useMemo(
    () => [...(lessonsQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [lessonsQuery.data],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    createMutation.mutate();
  }

  return (
    <section className="panel lesson-panel" aria-labelledby="lessons-panel-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="lessons-panel-title">
            Lessons
          </h3>
          <p className="panel-subtitle">Curriculum order</p>
        </div>
        <StatusBadge>{sortedLessons.length}</StatusBadge>
      </div>
      <div className="panel-body panel-stack">
        {lessonsQuery.isLoading && <LoadingBlock height={180} label="Loading lessons" />}
        {lessonsQuery.isError && (
          <p className="error-banner" role="alert">
            {getErrorMessage(lessonsQuery.error)}
          </p>
        )}
        {!lessonsQuery.isLoading && !lessonsQuery.isError && sortedLessons.length === 0 && (
          <EmptyState description="Curriculum is empty." title="Chua co lesson" />
        )}
        {sortedLessons.length > 0 && (
          <div className="lesson-list">
            {sortedLessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} />
            ))}
          </div>
        )}
        {canManage && (
          <form className="compact-form lesson-create-form" onSubmit={handleSubmit}>
            <Field
              label="Lesson title"
              name="lesson-title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
            <Field
              label="Description"
              name="lesson-description"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
            <Field
              label="Minutes"
              min={0}
              name="lesson-duration"
              onChange={(event) => setDurationMinutes(event.target.value)}
              type="number"
              value={durationMinutes}
            />
            <Button
              disabled={!title.trim() || createMutation.isPending}
              icon={<Plus size={16} aria-hidden="true" />}
              type="submit"
            >
              Tao lesson
            </Button>
          </form>
        )}
        {createMutation.isError && (
          <p className="field-error" role="alert">
            {getErrorMessage(createMutation.error)}
          </p>
        )}
      </div>
    </section>
  );
}

function LessonRow({ lesson }: { lesson: LessonResponse }) {
  return (
    <article className="lesson-row">
      <span className="lesson-order">{lesson.order}</span>
      <div className="lesson-main">
        <strong data-testid="lesson-row-title">{lesson.title}</strong>
        {lesson.description && <span>{lesson.description}</span>}
      </div>
      <span className="lesson-duration">
        <Clock size={15} aria-hidden="true" />
        {formatDuration(lesson.durationSeconds)}
      </span>
    </article>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(Math.round(seconds / 60), 0);
  return `${minutes} min`;
}
