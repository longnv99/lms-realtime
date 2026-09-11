import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { enrollCourse } from '../../api/courses';
import { listLessons } from '../../api/lessons';
import { getMyCourseProgress, updateLessonProgress } from '../../api/progress';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getErrorMessage } from '../../lib/errors';
import { useAuthStore } from '../auth/auth.store';
import { myEnrollmentsQueryKey, useMyEnrollmentIds } from '../enrollments/useMyEnrollmentIds';
import { LearningLessonNav } from './LearningLessonNav';
import { LessonNotesPanel } from './LessonNotesPanel';
import { LessonTranscriptPanel } from './LessonTranscriptPanel';
import { LearningPlayer } from './LearningPlayer';
import { QuizReviewPanel } from './QuizReviewPanel';
import type { LessonVideoProgressPayload } from '../media/LessonVideoPlayer';

type LearningRailTab = 'notes' | 'transcript' | 'quizReview';

export function LearningPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const playerHeadingRef = useRef<HTMLHeadingElement>(null);
  const [activeRailTab, setActiveRailTab] = useState<LearningRailTab>('notes');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const isStudent = user?.role === 'STUDENT';
  const { enrolledCourseIds, enrollmentsQuery } = useMyEnrollmentIds(
    Boolean(courseId && isStudent),
  );
  const canUseLearningWorkspace = Boolean(courseId && isStudent && enrolledCourseIds.has(courseId));

  const lessonsQuery = useQuery({
    enabled: canUseLearningWorkspace,
    queryKey: ['lessons', courseId],
    queryFn: () => listLessons(courseId ?? ''),
  });
  const progressQuery = useQuery({
    enabled: canUseLearningWorkspace,
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
  const enrollMutation = useMutation({
    mutationFn: enrollCourse,
    onSuccess: async (_, enrolledCourseId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myEnrollmentsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
        queryClient.invalidateQueries({ queryKey: ['my-course-progress', enrolledCourseId] }),
      ]);
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

  function handleVideoProgress(payload: LessonVideoProgressPayload) {
    progressMutation.mutate({
      completed: payload.completed ? true : undefined,
      lessonId: payload.lessonId,
      positionSeconds: payload.positionSeconds,
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

  if (!isStudent) {
    return (
      <div className="page learning-page">
        <LearningAccessPanel
          courseId={courseId}
          description="Use the course detail page to manage lessons, sessions, and learner progress."
          title="Learning workspace is for enrolled students"
        />
      </div>
    );
  }

  if (enrollmentsQuery.isLoading) {
    return (
      <div className="page learning-page">
        <LoadingBlock height={420} label="Checking enrollment" />
      </div>
    );
  }

  if (enrollmentsQuery.isError) {
    return (
      <div className="page learning-page">
        <p className="error-banner" role="alert">
          {getErrorMessage(enrollmentsQuery.error)}
        </p>
      </div>
    );
  }

  if (!canUseLearningWorkspace) {
    return (
      <div className="page learning-page">
        <LearningAccessPanel
          courseId={courseId}
          description="Enrollment unlocks lessons, progress tracking, notes, transcripts, and quiz review."
          enrollmentPending={enrollMutation.isPending}
          onEnroll={courseId ? () => enrollMutation.mutate(courseId) : undefined}
          title="Enroll to unlock this workspace"
        />
      </div>
    );
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
            onVideoProgress={handleVideoProgress}
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
                ) : activeRailTab === 'transcript' ? (
                  <LessonTranscriptPanel
                    activeSecond={selectedProgress?.positionSeconds ?? 0}
                    lessonId={selectedLesson.id}
                    onSeek={handleSeek}
                  />
                ) : (
                  <QuizReviewPanel
                    activeLessonId={selectedLesson.id}
                    courseId={courseId ?? ''}
                    onSelectLesson={handleSelectLesson}
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
  { id: 'quizReview', label: 'Quiz review' },
];

function LearningAccessPanel({
  courseId,
  description,
  enrollmentPending = false,
  onEnroll,
  title,
}: {
  courseId?: string;
  description: string;
  enrollmentPending?: boolean;
  onEnroll?: () => void;
  title: string;
}) {
  return (
    <>
      {courseId && (
        <Link className="button button-ghost detail-back" to={`/courses/${courseId}`}>
          <ArrowLeft size={18} aria-hidden="true" />
          Course detail
        </Link>
      )}
      <section className="panel course-access-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">{title}</h2>
            <p className="panel-subtitle">Enrollment required</p>
          </div>
          <StatusBadge tone="muted">Preview</StatusBadge>
        </div>
        <div className="panel-body panel-stack">
          <p className="course-access-description">{description}</p>
          {onEnroll && (
            <Button
              disabled={enrollmentPending}
              icon={<UserPlus size={16} aria-hidden="true" />}
              onClick={onEnroll}
            >
              Enroll now
            </Button>
          )}
        </div>
      </section>
    </>
  );
}
