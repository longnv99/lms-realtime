import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, PlayCircle } from 'lucide-react';
import type { LessonResponse } from '@lms/shared';
import type { Socket } from 'socket.io-client';
import { getMediaPlayback } from '../../api/media';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { emitProgressHeartbeat, type SocketStatus } from '../../lib/realtime';

type LessonPlaybackPanelProps = {
  lessons: LessonResponse[];
  lessonsError: Error | null;
  lessonsLoading: boolean;
  socket: Socket | null;
  socketStatus: SocketStatus;
};

const heartbeatIntervalSeconds = 10;

export function LessonPlaybackPanel({
  lessons,
  lessonsError,
  lessonsLoading,
  socket,
  socketStatus,
}: LessonPlaybackPanelProps) {
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const lastHeartbeatByLesson = useRef<Record<string, number>>({});
  const sortedLessons = useMemo(() => [...lessons].sort((a, b) => a.order - b.order), [lessons]);
  const selectedLesson = sortedLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const mediaAssetId = selectedLesson?.mediaAssetId ?? null;
  const playbackQuery = useQuery({
    enabled: Boolean(mediaAssetId),
    queryKey: ['media-playback', mediaAssetId],
    queryFn: () => getMediaPlayback(mediaAssetId ?? ''),
  });

  useEffect(() => {
    setSelectedLessonId((current) => current || sortedLessons[0]?.id || '');
  }, [sortedLessons]);

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!socket || socketStatus !== 'connected' || !selectedLesson) {
      return;
    }

    const positionSeconds = Math.floor(event.currentTarget.currentTime);
    const previousPosition = lastHeartbeatByLesson.current[selectedLesson.id] ?? 0;
    const reachedCompletion =
      selectedLesson.durationSeconds > 0 && positionSeconds >= selectedLesson.durationSeconds;

    if (
      positionSeconds <= previousPosition ||
      (positionSeconds - previousPosition < heartbeatIntervalSeconds && !reachedCompletion)
    ) {
      return;
    }

    lastHeartbeatByLesson.current[selectedLesson.id] = positionSeconds;
    emitProgressHeartbeat(socket, {
      lessonId: selectedLesson.id,
      positionSeconds,
    });
  }

  if (lessonsLoading) {
    return (
      <div className="playback-shell">
        <LoadingBlock height={360} label="Loading lesson media" />
      </div>
    );
  }

  if (lessonsError) {
    return (
      <div className="playback-shell">
        <p className="error-banner" role="alert">
          {getErrorMessage(lessonsError)}
        </p>
      </div>
    );
  }

  if (sortedLessons.length === 0) {
    return <EmptyState description="This course has no lessons yet." title="No lessons" />;
  }

  return (
    <div className="playback-shell">
      <div className="playback-toolbar">
        <label className="field playback-select" htmlFor="lesson-video">
          <span className="field-label">Lesson video</span>
          <select
            className="field-control"
            id="lesson-video"
            onChange={(event) => setSelectedLessonId(event.target.value)}
            value={selectedLessonId}
          >
            {sortedLessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </label>
        <StatusBadge tone={mediaAssetId ? 'success' : 'muted'}>
          {mediaAssetId ? 'Video ready' : 'No video'}
        </StatusBadge>
      </div>
      <div className="video-frame">
        {!mediaAssetId && <EmptyState description="No video attached" title="Media unavailable" />}
        {mediaAssetId && playbackQuery.isLoading && (
          <LoadingBlock height={320} label="Preparing playback" />
        )}
        {mediaAssetId && playbackQuery.isError && (
          <p className="error-banner" role="alert">
            {getErrorMessage(playbackQuery.error)}
          </p>
        )}
        {mediaAssetId && playbackQuery.data && selectedLesson && (
          <video
            aria-label={`Video player for ${selectedLesson.title}`}
            className="lesson-video-player"
            controls
            onTimeUpdate={handleTimeUpdate}
            src={playbackQuery.data.playbackUrl}
          />
        )}
      </div>
      {selectedLesson && (
        <div className="playback-meta">
          <span>
            <Film size={15} aria-hidden="true" />
            {selectedLesson.title}
          </span>
          <span>
            <PlayCircle size={15} aria-hidden="true" />
            Heartbeat every {heartbeatIntervalSeconds}s
          </span>
        </div>
      )}
    </div>
  );
}
