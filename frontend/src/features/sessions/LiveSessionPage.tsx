import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Radio, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import type { ChatMessagePayload, SessionStatePayload } from '@lms/shared';
import { listLessons } from '../../api/lessons';
import { getSessionState } from '../../api/sessions';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { createNamespaceSocket, useSocketStatus } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
import { QuizPanel } from '../quizzes/QuizPanel';
import { ChatPanel } from './ChatPanel';
import { LessonPlaybackPanel } from './LessonPlaybackPanel';

export function LiveSessionPage() {
  const { courseId, sessionId } = useParams<{ courseId?: string; sessionId: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [liveState, setLiveState] = useState<SessionStatePayload | null>(null);
  const socketStatus = useSocketStatus(socket);

  const stateQuery = useQuery({
    enabled: Boolean(sessionId),
    queryKey: ['session-state', sessionId],
    queryFn: () => getSessionState(sessionId ?? ''),
  });
  const lessonsQuery = useQuery({
    enabled: Boolean(courseId),
    queryKey: ['lessons', courseId],
    queryFn: () => listLessons(courseId ?? ''),
  });

  useEffect(() => {
    if (!accessToken || !sessionId) {
      return undefined;
    }

    const nextSocket = createNamespaceSocket('/sessions', accessToken);
    const handleState = (payload: SessionStatePayload) => {
      if (payload.id === sessionId) {
        setLiveState(payload);
      }
    };
    const handleMessage = (payload: ChatMessagePayload) => {
      if (payload.sessionId === sessionId) {
        setMessages((current) => [...current, payload]);
      }
    };

    setSocket(nextSocket);
    nextSocket.emit('session:join', { sessionId });
    nextSocket.on('session:state', handleState);
    nextSocket.on('chat:message', handleMessage);

    return () => {
      nextSocket.off('session:state', handleState);
      nextSocket.off('chat:message', handleMessage);
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [accessToken, sessionId]);

  const state = liveState ?? stateQuery.data ?? null;
  const participantCount = state?.participantCount ?? 0;
  const sessionStatus = state?.status ?? 'SCHEDULED';
  const statusTone =
    sessionStatus === 'LIVE' ? 'live' : sessionStatus === 'ENDED' ? 'success' : 'muted';
  const connectionLabel = useMemo(
    () => (socketStatus === 'connected' ? 'Socket connected' : 'Socket offline'),
    [socketStatus],
  );

  function handleSend(content: string) {
    if (!socket || !sessionId) {
      return;
    }

    socket.emit('chat:send', { content, sessionId });
  }

  if (stateQuery.isLoading) {
    return (
      <div className="page">
        <LoadingBlock height={320} label="Loading live session" />
      </div>
    );
  }

  if (stateQuery.isError) {
    return (
      <div className="page">
        <p className="error-banner" role="alert">
          {getErrorMessage(stateQuery.error)}
        </p>
      </div>
    );
  }

  return (
    <div className="page live-page">
      <Link
        className="button button-ghost detail-back"
        to={courseId ? `/courses/${courseId}` : '/courses'}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        {courseId ? 'Course detail' : 'Courses'}
      </Link>
      <section className="live-room-banner" aria-label="Live session status">
        <div className="live-room-copy">
          <StatusBadge tone={statusTone}>{sessionStatus}</StatusBadge>
          <h2 className="page-title">Live room</h2>
          <p className="page-description">{connectionLabel}</p>
        </div>
        <div className="live-banner-metrics">
          <div className="metric-line">
            <Users size={18} aria-hidden="true" />
            <strong>{participantCount} online</strong>
          </div>
          <div className="metric-line">
            <Radio size={18} aria-hidden="true" />
            <span>{sessionId}</span>
          </div>
        </div>
      </section>
      <section className="live-workspace">
        <section className="panel live-stage" aria-labelledby="live-stage-title">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" id="live-stage-title">
                Classroom stage
              </h2>
              <p className="panel-subtitle">Session workspace</p>
            </div>
          </div>
          <div className="panel-body live-stage-body">
            {courseId ? (
              <LessonPlaybackPanel
                lessons={lessonsQuery.data ?? []}
                lessonsError={lessonsQuery.error}
                lessonsLoading={lessonsQuery.isLoading}
                socket={socket}
                socketStatus={socketStatus}
              />
            ) : (
              <EmptyState
                description="Open this live room from a course to load lesson media."
                title="Ready"
              />
            )}
          </div>
        </section>
        <div className="live-side">
          <ChatPanel messages={messages} onSend={handleSend} />
          {sessionId && <QuizPanel sessionId={sessionId} />}
        </div>
      </section>
    </div>
  );
}
