import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, ListRestart, Lock, Square } from 'lucide-react';
import {
  closeQuestion,
  finishQuizRun,
  openNextQuestion,
  revealQuestion,
} from '../../api/quizzes';
import { Button } from '../../components/Button';
import { getErrorMessage } from '../../lib/errors';

type QuizInstructorControlsProps = {
  quizRunId: string;
};

export function QuizInstructorControls({ quizRunId }: QuizInstructorControlsProps) {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['quiz-run-state', quizRunId] });
  };
  const openMutation = useMutation({
    mutationFn: () => openNextQuestion(quizRunId),
    onSuccess: invalidate,
  });
  const closeMutation = useMutation({
    mutationFn: () => closeQuestion(quizRunId),
    onSuccess: invalidate,
  });
  const revealMutation = useMutation({
    mutationFn: () => revealQuestion(quizRunId),
    onSuccess: invalidate,
  });
  const finishMutation = useMutation({
    mutationFn: () => finishQuizRun(quizRunId),
    onSuccess: invalidate,
  });
  const error =
    openMutation.error ?? closeMutation.error ?? revealMutation.error ?? finishMutation.error;
  const busy =
    openMutation.isPending ||
    closeMutation.isPending ||
    revealMutation.isPending ||
    finishMutation.isPending;

  return (
    <section className="quiz-controls" aria-labelledby="quiz-controls-title">
      <div className="subpanel-header">
        <h4 id="quiz-controls-title">Controls</h4>
      </div>
      <div className="quiz-control-grid">
        <Button
          disabled={busy}
          icon={<ListRestart size={16} aria-hidden="true" />}
          onClick={() => openMutation.mutate()}
          variant="secondary"
        >
          Mo cau tiep
        </Button>
        <Button
          disabled={busy}
          icon={<Lock size={16} aria-hidden="true" />}
          onClick={() => closeMutation.mutate()}
          variant="secondary"
        >
          Dong cau
        </Button>
        <Button
          disabled={busy}
          icon={<Eye size={16} aria-hidden="true" />}
          onClick={() => revealMutation.mutate()}
          variant="secondary"
        >
          Reveal
        </Button>
        <Button
          disabled={busy}
          icon={<Square size={16} aria-hidden="true" />}
          onClick={() => finishMutation.mutate()}
          variant="ghost"
        >
          Ket thuc
        </Button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
    </section>
  );
}
