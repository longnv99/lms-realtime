import { FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getLessonTranscript } from '../../api/learning';
import { LoadingBlock } from '../../components/LoadingBlock';
import { getErrorMessage } from '../../lib/errors';

type LessonTranscriptPanelProps = {
  activeSecond: number;
  lessonId: string;
  onSeek: (seconds: number) => void;
};

export function LessonTranscriptPanel({
  activeSecond,
  lessonId,
  onSeek,
}: LessonTranscriptPanelProps) {
  const transcriptQuery = useQuery({
    queryKey: ['lesson-transcript', lessonId],
    queryFn: () => getLessonTranscript(lessonId),
  });

  if (transcriptQuery.isLoading) {
    return <LoadingBlock height={220} label="Loading transcript" />;
  }

  if (transcriptQuery.isError) {
    return (
      <p className="error-banner" role="alert">
        {getErrorMessage(transcriptQuery.error)}
      </p>
    );
  }

  const cues = transcriptQuery.data?.cues ?? [];

  if (cues.length === 0) {
    return (
      <div className="lesson-panel-empty">
        <FileText size={18} aria-hidden="true" />
        <span>No transcript available</span>
      </div>
    );
  }

  return (
    <div className="lesson-transcript-panel">
      {cues.map((cue) => {
        const isActive = activeSecond >= cue.startSeconds && activeSecond < cue.endSeconds;

        return (
          <button
            aria-current={isActive ? 'true' : undefined}
            className="transcript-cue"
            key={cue.id}
            onClick={() => onSeek(cue.startSeconds)}
            type="button"
          >
            <span className="transcript-timestamp">{formatTimestamp(cue.startSeconds)}</span>
            <span>{cue.text}</span>
          </button>
        );
      })}
    </div>
  );
}

export function formatTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
