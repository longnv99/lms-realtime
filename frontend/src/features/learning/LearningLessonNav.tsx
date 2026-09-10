import { CheckCircle2, CirclePlay, Clock3 } from 'lucide-react';
import type { LessonProgressResponse, LessonResponse } from '@lms/shared';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

type LearningLessonNavProps = {
  lessons: LessonResponse[];
  progressByLessonId: Map<string, LessonProgressResponse>;
  selectedLessonId: string;
  onSelectLesson: (lessonId: string) => void;
};

export function LearningLessonNav({
  lessons,
  onSelectLesson,
  progressByLessonId,
  selectedLessonId,
}: LearningLessonNavProps) {
  return (
    <aside className="learning-nav" aria-label="Course lessons">
      <div className="learning-nav-header">
        <h3>Course path</h3>
        <Badge variant="muted">{lessons.length} lessons</Badge>
      </div>
      <div className="learning-mobile-picker">
        <Select onValueChange={onSelectLesson} value={selectedLessonId}>
          <SelectTrigger aria-label="Select lesson" className="learning-select">
            <SelectValue placeholder="Select lesson" />
          </SelectTrigger>
          <SelectContent>
            {lessons.map((lesson) => (
              <SelectItem key={lesson.id} value={lesson.id}>
                {lesson.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="learning-lesson-list">
        {lessons.map((lesson) => {
          const progress = progressByLessonId.get(lesson.id);
          const isSelected = lesson.id === selectedLessonId;
          const isCompleted = Boolean(progress?.completedAt);
          const percent = getLessonPercent(lesson, progress);

          return (
            <button
              aria-current={isSelected ? 'step' : undefined}
              className="learning-lesson-button"
              key={lesson.id}
              onClick={() => onSelectLesson(lesson.id)}
              type="button"
            >
              <span className="learning-lesson-icon">
                {isCompleted ? (
                  <CheckCircle2 size={17} aria-hidden="true" />
                ) : (
                  <CirclePlay size={17} aria-hidden="true" />
                )}
              </span>
              <span className="learning-lesson-copy">
                <strong>{lesson.title}</strong>
                <span>
                  <Clock3 size={13} aria-hidden="true" />
                  {formatDuration(lesson.durationSeconds)}
                </span>
              </span>
              <span className="learning-lesson-percent">{percent}%</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function getLessonPercent(
  lesson: Pick<LessonResponse, 'durationSeconds'>,
  progress?: Pick<LessonProgressResponse, 'completedAt' | 'positionSeconds'>,
): number {
  if (progress?.completedAt) {
    return 100;
  }

  if (!progress || lesson.durationSeconds <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((progress.positionSeconds / lesson.durationSeconds) * 100));
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}
