import { BookmarkCheck, CheckCircle2, Clock3, PlayCircle, RotateCcw } from 'lucide-react';
import type { LessonProgressResponse, LessonResponse } from '@lms/shared';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { formatDuration, getLessonPercent } from './LearningLessonNav';

type LearningPlayerProps = {
  lesson: LessonResponse | null;
  progress: LessonProgressResponse | undefined;
  progressPending: boolean;
  onMarkComplete: () => void;
  onResetProgress: () => void;
};

export function LearningPlayer({
  lesson,
  onMarkComplete,
  onResetProgress,
  progress,
  progressPending,
}: LearningPlayerProps) {
  if (!lesson) {
    return (
      <Card className="learning-player">
        <CardContent>
          <LoadingBlock height={360} label="Loading learning workspace" />
        </CardContent>
      </Card>
    );
  }

  const percent = getLessonPercent(lesson, progress);
  const isCompleted = Boolean(progress?.completedAt);
  const resumeCopy = progress?.lastWatchedAt
    ? `Resume at ${formatDuration(progress.positionSeconds)}`
    : 'Start from the beginning';

  return (
    <Card className="learning-player">
      <CardHeader className="learning-player-header">
        <div>
          <CardTitle>{lesson.title}</CardTitle>
          <p className="learning-player-description">
            {lesson.description ?? 'Work through the lesson and save your progress.'}
          </p>
        </div>
        <StatusBadge tone={isCompleted ? 'success' : 'muted'}>
          {isCompleted ? 'Completed' : 'In progress'}
        </StatusBadge>
      </CardHeader>
      <CardContent className="learning-player-body">
        <div className="learning-video-stage">
          <div className="learning-video-symbol">
            <PlayCircle size={42} aria-hidden="true" />
          </div>
          <div className="learning-video-copy">
            <strong>{lesson.mediaAssetId ? 'Lesson media ready' : 'Media not attached'}</strong>
            <span>{resumeCopy}</span>
          </div>
        </div>
        <div className="learning-player-meta" aria-label="Lesson progress">
          <span>
            <Clock3 size={15} aria-hidden="true" />
            {formatDuration(lesson.durationSeconds)}
          </span>
          <span>
            <BookmarkCheck size={15} aria-hidden="true" />
            {percent}% complete
          </span>
        </div>
        <Progress value={percent} />
        <TooltipProvider>
          <div className="learning-player-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Mark complete"
                  disabled={progressPending || isCompleted}
                  onClick={onMarkComplete}
                  size="icon"
                  type="button"
                >
                  <CheckCircle2 aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark complete</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Reset progress"
                  disabled={progressPending || percent === 0}
                  onClick={onResetProgress}
                  size="icon"
                  type="button"
                  variant="secondary"
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset progress</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
