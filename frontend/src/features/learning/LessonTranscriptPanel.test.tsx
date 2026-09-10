import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonTranscriptResponse } from '@lms/shared';
import { getLessonTranscript } from '../../api/learning';
import { LessonTranscriptPanel } from './LessonTranscriptPanel';

vi.mock('../../api/learning', () => ({
  getLessonTranscript: vi.fn(),
}));

const mockedGetLessonTranscript = vi.mocked(getLessonTranscript);

describe('LessonTranscriptPanel', () => {
  beforeEach(() => {
    mockedGetLessonTranscript.mockReset();
    mockedGetLessonTranscript.mockResolvedValue(transcriptFixture());
  });

  it('renders timestamp rows and seeks when a cue is selected', async () => {
    const onSeek = vi.fn();
    renderPanel(onSeek);

    expect(await screen.findByText('Welcome to the realtime classroom.')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /00:15 Welcome to the realtime classroom/i }),
    );

    expect(onSeek).toHaveBeenCalledWith(15);
  });

  it('renders a concise empty state', async () => {
    mockedGetLessonTranscript.mockResolvedValue({ cues: [], lessonId: 'lesson-1' });

    renderPanel(vi.fn());

    expect(await screen.findByText('No transcript available')).toBeInTheDocument();
  });
});

function renderPanel(onSeek: (seconds: number) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonTranscriptPanel activeSecond={20} lessonId="lesson-1" onSeek={onSeek} />
    </QueryClientProvider>,
  );
}

function transcriptFixture(): LessonTranscriptResponse {
  return {
    lessonId: 'lesson-1',
    cues: [
      {
        createdAt: '2026-09-09T09:10:00.000Z',
        endSeconds: 35,
        id: 'cue-1',
        lessonId: 'lesson-1',
        order: 1,
        startSeconds: 15,
        text: 'Welcome to the realtime classroom.',
        updatedAt: '2026-09-09T09:10:00.000Z',
      },
    ],
  };
}
