import { BookmarkCheck, CheckCircle2, Clock3, RotateCcw } from 'lucide-react';
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
import { LessonVideoPlayer, type LessonVideoProgressPayload } from '../media/LessonVideoPlayer';
import { formatDuration, getLessonPercent } from './LearningLessonNav';

type LearningPlayerProps = {
  lesson: LessonResponse | null;
  onMarkComplete: () => void;
  onResetProgress: () => void;
  onVideoProgress: (payload: LessonVideoProgressPayload) => void;
  progress: LessonProgressResponse | undefined;
  progressPending: boolean;
};

export function LearningPlayer({
  lesson,
  onMarkComplete,
  onResetProgress,
  onVideoProgress,
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
        <div className="learning-player-heading">
          <CardTitle>{lesson.title}</CardTitle>
          <p className="learning-player-description">
            {lesson.description ?? 'Work through the lesson and save your progress.'}
          </p>
        </div>
        <TooltipProvider>
          <div className="learning-player-controls">
            <StatusBadge tone={isCompleted ? 'success' : 'muted'}>
              {isCompleted ? 'Completed' : 'In progress'}
            </StatusBadge>
            <div className="learning-player-action-group" aria-label="Lesson actions">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Mark complete"
                    className="learning-player-action"
                    disabled={progressPending || isCompleted}
                    onClick={onMarkComplete}
                    size="icon"
                    type="button"
                    variant={isCompleted ? 'secondary' : 'default'}
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
                    className="learning-player-action"
                    disabled={progressPending || percent === 0}
                    onClick={onResetProgress}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <RotateCcw aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset progress</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="learning-player-body">
        <LessonVideoPlayer
          initialPositionSeconds={progress?.positionSeconds ?? 0}
          lesson={lesson}
          onProgress={onVideoProgress}
        />
        <div className="learning-player-meta" aria-label="Lesson progress">
          <span className="learning-video-resume">{resumeCopy}</span>
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
      </CardContent>
    </Card>
  );
}
