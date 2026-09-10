import { seedLessons, seedTranscriptCues } from '../prisma/seeds/data';
import { getSeedModuleNames, parseSeedOptions } from '../prisma/seeds';
import { resolveProgressSeedRow } from '../prisma/seeds/progress.seed';

describe('seed configuration', () => {
  it('runs in safe mode by default', () => {
    expect(parseSeedOptions([])).toEqual({ reset: false });
  });

  it('supports explicit reset mode', () => {
    expect(parseSeedOptions(['--reset'])).toEqual({ reset: true });
  });

  it('keeps future seed changes behind one ordered entrypoint', () => {
    expect(getSeedModuleNames()).toEqual([
      'users',
      'courses',
      'lessons',
      'sessions',
      'enrollments',
      'progress',
      'quizzes',
    ]);
  });

  it('does not move existing learner progress backward during safe seed', () => {
    const completedAt = new Date('2026-09-08T01:00:00.000Z');
    const lastWatchedAt = new Date('2026-09-08T02:00:00.000Z');

    expect(
      resolveProgressSeedRow(
        {
          positionSeconds: 700,
          completedAt,
          lastWatchedAt,
        },
        {
          positionSeconds: 420,
          completedAt: undefined,
          lastWatchedAt: new Date('2026-09-08T00:00:00.000Z'),
        },
      ),
    ).toEqual({
      positionSeconds: 700,
      completedAt,
      lastWatchedAt,
    });
  });

  it('defines transcript cues for every seeded lesson', () => {
    const lessonOrders = Object.values(seedLessons).map((lesson) => lesson.order);
    const transcriptLessonOrders = seedTranscriptCues.map((transcript) => transcript.lessonOrder);

    expect(transcriptLessonOrders.sort((a, b) => a - b)).toEqual(
      lessonOrders.sort((a, b) => a - b),
    );
    expect(seedTranscriptCues.every((transcript) => transcript.cues.length > 0)).toBe(true);
  });
});
