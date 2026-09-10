import { useEffect, useMemo, useState } from 'react';
import { Film, PlayCircle } from 'lucide-react';
import type { LessonResponse } from '@lms/shared';
import type { Socket } from 'socket.io-client';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { emitProgressHeartbeat, type SocketStatus } from '../../lib/realtime';
import { LessonVideoPlayer, type LessonVideoProgressPayload } from '../media/LessonVideoPlayer';

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
  const sortedLessons = useMemo(() => [...lessons].sort((a, b) => a.order - b.order), [lessons]);
  const selectedLesson = sortedLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const mediaAssetId = selectedLesson?.mediaAssetId ?? null;

  useEffect(() => {
    setSelectedLessonId((current) => current || sortedLessons[0]?.id || '');
  }, [sortedLessons]);

  function handleVideoProgress(payload: LessonVideoProgressPayload) {
    if (!socket || socketStatus !== 'connected') {
      return;
    }

    emitProgressHeartbeat(socket, {
      lessonId: payload.lessonId,
      positionSeconds: payload.positionSeconds,
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
      <LessonVideoPlayer lesson={selectedLesson} onProgress={handleVideoProgress} />
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
