import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Play, Plus, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SessionResponse, SessionStatus } from '@lms/shared';
import {
  createSession,
  endSession,
  listSessions,
  startSession,
} from '../../api/sessions';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Field } from '../../components/Field';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';

type SessionsPanelProps = {
  canManage: boolean;
  courseId: string;
};

const sessionGroups: Array<{ label: string; status: SessionStatus }> = [
  { label: 'LIVE', status: 'LIVE' },
  { label: 'SCHEDULED', status: 'SCHEDULED' },
  { label: 'ENDED', status: 'ENDED' },
  { label: 'CANCELLED', status: 'CANCELLED' },
];

export function SessionsPanel({ canManage, courseId }: SessionsPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(defaultDateTimeLocal());

  const sessionsQuery = useQuery({
    queryKey: ['sessions', courseId],
    queryFn: () => listSessions(courseId),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createSession(courseId, { startsAt: new Date(startsAt).toISOString(), title: title.trim() }),
    onSuccess: async () => {
      setTitle('');
      setStartsAt(defaultDateTimeLocal());
      await queryClient.invalidateQueries({ queryKey: ['sessions', courseId] });
    },
  });
  const startMutation = useMutation({
    mutationFn: (sessionId: string) => startSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', courseId] });
    },
  });
  const endMutation = useMutation({
    mutationFn: (sessionId: string) => endSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', courseId] });
    },
  });

  const grouped = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];
    return sessionGroups.map((group) => ({
      ...group,
      sessions: sessions.filter((session) => session.status === group.status),
    }));
  }, [sessionsQuery.data]);
  const count = sessionsQuery.data?.length ?? 0;
  const actionError = createMutation.error ?? startMutation.error ?? endMutation.error;

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !startsAt) {
      return;
    }
    createMutation.mutate();
  }

  return (
    <section className="panel session-panel" aria-labelledby="sessions-panel-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="sessions-panel-title">
            Live sessions
          </h3>
          <p className="panel-subtitle">Room schedule</p>
        </div>
        <StatusBadge>{count}</StatusBadge>
      </div>
      <div className="panel-body panel-stack">
        {sessionsQuery.isLoading && <LoadingBlock height={220} label="Loading sessions" />}
        {sessionsQuery.isError && (
          <p className="error-banner" role="alert">
            {getErrorMessage(sessionsQuery.error)}
          </p>
        )}
        {!sessionsQuery.isLoading && !sessionsQuery.isError && count === 0 && (
          <EmptyState description="No rooms have been scheduled." title="No sessions yet" />
        )}
        {count > 0 && (
          <div className="session-groups">
            {grouped.map((group) =>
              group.sessions.length > 0 ? (
                <section className="session-group" key={group.status}>
                  <div className="session-group-header">
                    <StatusBadge tone={statusTone(group.status)}>{group.label}</StatusBadge>
                    <span>{group.sessions.length}</span>
                  </div>
                  <div className="session-list">
                    {group.sessions.map((session) => (
                      <SessionRow
                        canManage={canManage}
                        endDisabled={endMutation.isPending}
                        key={session.id}
                        onEnd={() => endMutation.mutate(session.id)}
                        onStart={() => startMutation.mutate(session.id)}
                        session={session}
                        startDisabled={startMutation.isPending}
                      />
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </div>
        )}
        {canManage && (
          <form className="compact-form session-create-form" onSubmit={handleCreate}>
            <Field
              label="Session title"
              name="session-title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
            <Field
              label="Starts at"
              name="session-starts-at"
              onChange={(event) => setStartsAt(event.target.value)}
              type="datetime-local"
              value={startsAt}
            />
            <Button
              disabled={!title.trim() || !startsAt || createMutation.isPending}
              icon={<Plus size={16} aria-hidden="true" />}
              type="submit"
            >
              Create session
            </Button>
          </form>
        )}
        {actionError && (
          <p className="field-error" role="alert">
            {getErrorMessage(actionError)}
          </p>
        )}
      </div>
    </section>
  );
}

function SessionRow({
  canManage,
  endDisabled,
  onEnd,
  onStart,
  session,
  startDisabled,
}: {
  canManage: boolean;
  endDisabled: boolean;
  onEnd: () => void;
  onStart: () => void;
  session: SessionResponse;
  startDisabled: boolean;
}) {
  return (
    <article className="session-row">
      <div className="session-main">
        <strong>{session.title}</strong>
        <span>
          <CalendarClock size={15} aria-hidden="true" />
          {formatDateTime(session.startsAt)}
        </span>
      </div>
      <div className="session-actions">
        {session.status === 'LIVE' && (
          <Link
            aria-label={`Enter live room ${session.title}`}
            className="button button-primary"
            to={`/courses/${session.courseId}/sessions/${session.id}/live`}
          >
            <Play size={16} aria-hidden="true" />
            Enter live
          </Link>
        )}
        {canManage && session.status === 'SCHEDULED' && (
          <Button
            aria-label={`Start ${session.title}`}
            disabled={startDisabled}
            icon={<Play size={16} aria-hidden="true" />}
            onClick={onStart}
            variant="secondary"
          >
            Start
          </Button>
        )}
        {canManage && session.status === 'LIVE' && (
          <Button
            aria-label={`End ${session.title}`}
            disabled={endDisabled}
            icon={<Square size={16} aria-hidden="true" />}
            onClick={onEnd}
            variant="secondary"
          >
            End
          </Button>
        )}
      </div>
    </article>
  );
}

function defaultDateTimeLocal(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusTone(status: SessionStatus): 'live' | 'muted' | 'success' {
  if (status === 'LIVE') {
    return 'live';
  }
  if (status === 'ENDED') {
    return 'success';
  }
  return 'muted';
}
