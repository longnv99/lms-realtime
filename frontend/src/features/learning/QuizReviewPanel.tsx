import { CheckCircle2, CircleHelp, FileQuestion, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMyCourseQuizReviews } from '../../api/quizzes';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { LoadingBlock } from '../../components/LoadingBlock';
import { getErrorMessage } from '../../lib/errors';

type QuizReviewPanelProps = {
  activeLessonId: string | null;
  courseId: string;
  onSelectLesson: (lessonId: string) => void;
};

export function QuizReviewPanel({
  activeLessonId,
  courseId,
  onSelectLesson,
}: QuizReviewPanelProps) {
  const reviewsQuery = useQuery({
    enabled: Boolean(courseId),
    queryKey: ['course-quiz-reviews', courseId],
    queryFn: () => getMyCourseQuizReviews(courseId),
  });

  if (reviewsQuery.isLoading) {
    return <LoadingBlock height={220} label="Loading quiz review" />;
  }

  if (reviewsQuery.isError) {
    return (
      <p className="error-banner" role="alert">
        {getErrorMessage(reviewsQuery.error)}
      </p>
    );
  }

  const reviews = [...(reviewsQuery.data?.reviews ?? [])].sort(
    (a, b) => Date.parse(b.finishedAt ?? b.startedAt) - Date.parse(a.finishedAt ?? a.startedAt),
  );

  if (reviews.length === 0) {
    return (
      <section className="quiz-review-panel" aria-label="Quiz review">
        <h4>Quiz review</h4>
        <div className="lesson-panel-empty">
          <FileQuestion size={18} aria-hidden="true" />
          <span>Completed quiz reviews will appear here.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="quiz-review-panel" aria-label="Quiz review">
      <h4>Quiz review</h4>
      <div className="quiz-review-list">
        {reviews.map((review) => (
          <article
            aria-current={review.lessonId === activeLessonId ? 'true' : undefined}
            className="quiz-review-card"
            key={review.quizRunId}
          >
            <div className="quiz-review-card-header">
              <div>
                <span>{review.lessonTitle}</span>
                <strong>{review.quizTitle}</strong>
              </div>
              <Badge variant="muted">
                {review.correctCount} / {review.questionCount} correct
              </Badge>
            </div>
            <div className="quiz-review-questions">
              {review.questions.map((question) => (
                <div className="quiz-review-question" key={question.questionId}>
                  <span className="quiz-review-icon">
                    {question.isCorrect === true ? (
                      <CheckCircle2 size={16} aria-hidden="true" />
                    ) : question.isCorrect === false ? (
                      <XCircle size={16} aria-hidden="true" />
                    ) : (
                      <CircleHelp size={16} aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <strong>{question.text}</strong>
                    <span>
                      Your answer:{' '}
                      {findOptionText(question.options, question.selectedOptionId) ?? 'No answer'}
                    </span>
                    {question.explanation ? <p>{question.explanation}</p> : null}
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="quiz-review-action"
              onClick={() => onSelectLesson(review.lessonId)}
              size="sm"
              type="button"
              variant="secondary"
            >
              Review lesson
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function findOptionText(
  options: Array<{ id: string; text: string }>,
  optionId: string | null,
): string | null {
  if (!optionId) {
    return null;
  }

  return options.find((option) => option.id === optionId)?.text ?? null;
}
