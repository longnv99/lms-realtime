import type { QuizOption, QuizQuestionPayload } from '@lms/shared';

type QuizStudentAnswerGridProps = {
  correctOptionId: string | null;
  isLocked: boolean;
  onAnswer: (option: QuizOption) => void;
  question: QuizQuestionPayload['question'];
  selectedOptionId: string | null;
};

export function QuizStudentAnswerGrid({
  correctOptionId,
  isLocked,
  onAnswer,
  question,
  selectedOptionId,
}: QuizStudentAnswerGridProps) {
  return (
    <section className="quiz-question" aria-labelledby="quiz-question-title">
      <div>
        <span className="quiz-kicker">Question</span>
        <h4 id="quiz-question-title">{question.text}</h4>
      </div>
      <div className="quiz-options">
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect = correctOptionId === option.id;
          const classes = [
            'quiz-option',
            isSelected ? 'is-selected' : '',
            isCorrect ? 'is-correct' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              className={classes}
              disabled={isLocked || Boolean(selectedOptionId)}
              key={option.id}
              onClick={() => onAnswer(option)}
              type="button"
            >
              <span>{option.id.toUpperCase()}</span>
              <strong>{option.text}</strong>
              {isCorrect && <em>Correct</em>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
