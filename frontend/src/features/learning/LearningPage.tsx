import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listLessons } from '../../api/lessons';
import { getMyCourseProgress, updateLessonProgress } from '../../api/progress';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getErrorMessage } from '../../lib/errors';
import { LearningLessonNav } from './LearningLessonNav';
import { LessonNotesPanel } from './LessonNotesPanel';
import { LessonTranscriptPanel } from './LessonTranscriptPanel';
import { LearningPlayer } from './LearningPlayer';

type LearningRailTab = 'notes' | 'transcript';

export function LearningPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const playerHeadingRef = useRef<HTMLHeadingElement>(null);
  const [activeRailTab, setActiveRailTab] = useState<LearningRailTab>('notes');
  const [selectedLessonId, setSelectedLessonId] = useState('');

  const lessonsQuery = useQuery({
    enabled: Boolean(courseId),
    queryKey: ['lessons', courseId],
    queryFn: () => listLessons(courseId ?? ''),
  });
  const progressQuery = useQuery({
    enabled: Boolean(courseId),
    queryKey: ['my-course-progress', courseId],
    queryFn: () => getMyCourseProgress(courseId ?? ''),
  });

  const lessons = useMemo(
    () => [...(lessonsQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [lessonsQuery.data],
  );
  const progressByLessonId = useMemo(
    () =>
      new Map(
        (progressQuery.data?.lessons ?? []).map((lessonProgress) => [
          lessonProgress.lessonId,
          lessonProgress,
        ]),
      ),
    [progressQuery.data],
  );
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const selectedProgress = selectedLesson ? progressByLessonId.get(selectedLesson.id) : undefined;

  const progressMutation = useMutation({
    mutationFn: ({
      completed,
      lessonId,
      positionSeconds,
    }: {
      completed?: boolean;
      lessonId: string;
      positionSeconds: number;
    }) => updateLessonProgress(lessonId, { completed, positionSeconds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-course-progress', courseId] });
    },
  });

  useEffect(() => {
    setSelectedLessonId((current) => current || lessons[0]?.id || '');
  }, [lessons]);

  function handleSelectLesson(lessonId: string) {
    setSelectedLessonId(lessonId);
    playerHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleMarkComplete() {
    if (!selectedLesson) {
      return;
    }

    progressMutation.mutate({
      completed: true,
      lessonId: selectedLesson.id,
      positionSeconds: selectedLesson.durationSeconds,
    });
  }

  function handleResetProgress() {
    if (!selectedLesson) {
      return;
    }

    progressMutation.mutate({
      completed: false,
      lessonId: selectedLesson.id,
      positionSeconds: 0,
    });
  }

  function handleSeek(seconds: number) {
    if (!selectedLesson) {
      return;
    }

    progressMutation.mutate({
      lessonId: selectedLesson.id,
      positionSeconds: Math.min(selectedLesson.durationSeconds, Math.max(0, Math.floor(seconds))),
    });
  }

  if (lessonsQuery.isLoading || progressQuery.isLoading) {
    return (
      <div className="page learning-page">
        <LoadingBlock height={420} label="Loading learning workspace" />
      </div>
    );
  }

  if (lessonsQuery.isError || progressQuery.isError) {
    return (
      <div className="page learning-page">
        <p className="error-banner" role="alert">
          {getErrorMessage(lessonsQuery.error ?? progressQuery.error)}
        </p>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="page learning-page">
        <EmptyState
          description="Lessons published for this course will appear here."
          title="No lessons available"
        />
      </div>
    );
  }

  return (
    <div className="page learning-page">
      <Link className="button button-ghost detail-back" to={`/courses/${courseId}`}>
        <ArrowLeft size={18} aria-hidden="true" />
        Course detail
      </Link>
      <section className="learning-hero">
        <div className="learning-hero-copy">
          <StatusBadge tone="success">Learning path</StatusBadge>
          <h2 className="page-title" ref={playerHeadingRef}>
            Learning workspace
          </h2>
          <p className="page-description">
            Continue lessons, save completion state, and keep your review flow close to the media.
          </p>
        </div>
        <div className="learning-summary">
          <span>{progressQuery.data?.completedLessons ?? 0} completed</span>
          <strong>{progressQuery.data?.percent ?? 0}%</strong>
          <small>{progressQuery.data?.totalLessons ?? lessons.length} lessons total</small>
        </div>
      </section>
      <section className="learning-workspace">
        <LearningLessonNav
          lessons={lessons}
          onSelectLesson={handleSelectLesson}
          progressByLessonId={progressByLessonId}
          selectedLessonId={selectedLessonId}
        />
        <div className="learning-stage">
          <LearningPlayer
            lesson={selectedLesson}
            onMarkComplete={handleMarkComplete}
            onResetProgress={handleResetProgress}
            progress={selectedProgress}
            progressPending={progressMutation.isPending}
          />
        </div>
        <Card className="learning-rail">
          <CardHeader>
            <CardTitle>Study tools</CardTitle>
          </CardHeader>
          <CardContent className="learning-rail-body">
            <div aria-label="Study tool tabs" className="learning-tabs" role="tablist">
              {learningRailTabs.map((tab) => (
                <button
                  aria-selected={activeRailTab === tab.id}
                  className="learning-tab"
                  key={tab.id}
                  onClick={() => setActiveRailTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {selectedLesson ? (
              <div className="learning-tab-panel" role="tabpanel">
                {activeRailTab === 'notes' ? (
                  <LessonNotesPanel
                    currentPositionSeconds={selectedProgress?.positionSeconds ?? 0}
                    lessonId={selectedLesson.id}
                  />
                ) : (
                  <LessonTranscriptPanel
                    activeSecond={selectedProgress?.positionSeconds ?? 0}
                    lessonId={selectedLesson.id}
                    onSeek={handleSeek}
                  />
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

const learningRailTabs: Array<{ id: LearningRailTab; label: string }> = [
  { id: 'notes', label: 'Notes' },
  { id: 'transcript', label: 'Transcript' },
];
