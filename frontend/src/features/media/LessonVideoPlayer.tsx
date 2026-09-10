import { useEffect, useRef, type SyntheticEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, PlayCircle } from 'lucide-react';
import type { LessonResponse } from '@lms/shared';
import { getMediaPlayback } from '../../api/media';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';

export type LessonVideoProgressPayload = {
  lessonId: string;
  positionSeconds: number;
  completed: boolean;
};

type LessonVideoPlayerProps = {
  initialPositionSeconds?: number;
  lesson: LessonResponse | null;
  onProgress?: (payload: LessonVideoProgressPayload) => void;
  progressIntervalSeconds?: number;
  showProgressHint?: boolean;
};

export function LessonVideoPlayer({
  initialPositionSeconds = 0,
  lesson,
  onProgress,
  progressIntervalSeconds = 10,
  showProgressHint = false,
}: LessonVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasAppliedInitialSeekRef = useRef(false);
  const lastProgressRef = useRef<Record<string, number>>({});
  const mediaAssetId = lesson?.mediaAssetId ?? null;
  const playbackQuery = useQuery({
    enabled: Boolean(mediaAssetId),
    queryKey: ['media-playback', mediaAssetId],
    queryFn: () => getMediaPlayback(mediaAssetId ?? ''),
  });

  useEffect(() => {
    hasAppliedInitialSeekRef.current = false;
  }, [lesson?.id, initialPositionSeconds]);

  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (!video || !lesson) {
        return;
      }

      emitProgress(Math.floor(video.currentTime), { force: true });
    };
    // The cleanup intentionally captures the current lesson and callback for the active video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  function emitProgress(
    rawPositionSeconds: number,
    { completed = false, force = false }: { completed?: boolean; force?: boolean } = {},
  ) {
    if (!lesson || !onProgress) {
      return;
    }

    const positionSeconds = clampPosition(rawPositionSeconds, lesson.durationSeconds);
    const previousPosition = lastProgressRef.current[lesson.id] ?? 0;
    const reachedCompletion =
      completed || (lesson.durationSeconds > 0 && positionSeconds >= lesson.durationSeconds);

    if (
      !force &&
      !reachedCompletion &&
      (positionSeconds <= previousPosition ||
        positionSeconds - previousPosition < progressIntervalSeconds)
    ) {
      return;
    }

    if (force && !reachedCompletion && positionSeconds === previousPosition) {
      return;
    }

    lastProgressRef.current[lesson.id] = positionSeconds;
    onProgress({
      completed: reachedCompletion,
      lessonId: lesson.id,
      positionSeconds,
    });
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    if (!lesson || hasAppliedInitialSeekRef.current || initialPositionSeconds <= 0) {
      return;
    }

    event.currentTarget.currentTime = clampPosition(initialPositionSeconds, lesson.durationSeconds);
    hasAppliedInitialSeekRef.current = true;
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    emitProgress(Math.floor(event.currentTarget.currentTime));
  }

  function handlePause(event: SyntheticEvent<HTMLVideoElement>) {
    emitProgress(Math.floor(event.currentTarget.currentTime), { force: true });
  }

  function handleSeeked(event: SyntheticEvent<HTMLVideoElement>) {
    emitProgress(Math.floor(event.currentTarget.currentTime), { force: true });
  }

  function handleEnded(event: SyntheticEvent<HTMLVideoElement>) {
    emitProgress(Math.floor(event.currentTarget.currentTime), { completed: true, force: true });
  }

  if (!lesson) {
    return <LoadingBlock height={320} label="Loading lesson media" />;
  }

  if (!mediaAssetId) {
    return (
      <div className="lesson-video-shell">
        <div className="video-frame">
          <EmptyState description="No video attached" title="Media unavailable" />
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-video-shell">
      <div className="video-frame">
        {playbackQuery.isLoading && <LoadingBlock height={320} label="Preparing playback" />}
        {playbackQuery.isError && (
          <p className="error-banner" role="alert">
            {getErrorMessage(playbackQuery.error)}
          </p>
        )}
        {playbackQuery.data && (
          <video
            aria-label={`Video player for ${lesson.title}`}
            className="lesson-video-player"
            controls
            onEnded={handleEnded}
            onLoadedMetadata={handleLoadedMetadata}
            onPause={handlePause}
            onSeeked={handleSeeked}
            onTimeUpdate={handleTimeUpdate}
            ref={videoRef}
            src={playbackQuery.data.playbackUrl}
          />
        )}
      </div>
      {showProgressHint && (
        <div className="lesson-video-meta">
          <StatusBadge tone="success">Video ready</StatusBadge>
          <span>
            <Film size={15} aria-hidden="true" />
            {lesson.title}
          </span>
          <span>
            <PlayCircle size={15} aria-hidden="true" />
            Progress saves every {progressIntervalSeconds}s
          </span>
        </div>
      )}
    </div>
  );
}

function clampPosition(positionSeconds: number, durationSeconds: number): number {
  return Math.min(Math.max(Math.floor(positionSeconds), 0), Math.max(durationSeconds, 0));
}
