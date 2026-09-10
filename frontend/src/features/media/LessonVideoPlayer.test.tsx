import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonResponse } from '@lms/shared';
import { getMediaPlayback } from '../../api/media';
import { LessonVideoPlayer } from './LessonVideoPlayer';

vi.mock('../../api/media', () => ({
  getMediaPlayback: vi.fn(),
}));

const mockedGetMediaPlayback = vi.mocked(getMediaPlayback);

describe('LessonVideoPlayer', () => {
  beforeEach(() => {
    mockedGetMediaPlayback.mockReset();
    mockedGetMediaPlayback.mockResolvedValue({
      assetId: 'asset-1',
      expiresInSeconds: 1800,
      playbackUrl: 'http://localhost:9000/playback.mp4',
    });
  });

  it('renders lesson media from a playback URL', async () => {
    renderLessonVideoPlayer();

    expect(await screen.findByLabelText(/video player for intro lesson/i)).toHaveAttribute(
      'src',
      'http://localhost:9000/playback.mp4',
    );
    expect(mockedGetMediaPlayback).toHaveBeenCalledWith('asset-1');
  });

  it('shows an empty state when the lesson has no media', () => {
    renderLessonVideoPlayer({ lesson: lessonFixture({ mediaAssetId: null }) });

    expect(screen.getByText('No video attached')).toBeInTheDocument();
    expect(mockedGetMediaPlayback).not.toHaveBeenCalled();
  });

  it('shows the playback error when the playback URL cannot be prepared', async () => {
    mockedGetMediaPlayback.mockRejectedValue(new Error('Playback URL expired.'));

    renderLessonVideoPlayer();

    expect(await screen.findByRole('alert')).toHaveTextContent('Playback URL expired.');
  });

  it('seeks to the initial position once metadata loads', async () => {
    renderLessonVideoPlayer({ initialPositionSeconds: 42 });
    const player = await screen.findByLabelText(/video player for intro lesson/i);

    fireEvent.loadedMetadata(player);

    expect((player as HTMLVideoElement).currentTime).toBe(42);
  });

  it('emits throttled progress and completion events', async () => {
    const onProgress = vi.fn();
    renderLessonVideoPlayer({ onProgress });
    const player = await screen.findByLabelText(/video player for intro lesson/i);

    setVideoTime(player, 8);
    fireEvent.timeUpdate(player);
    setVideoTime(player, 12);
    fireEvent.timeUpdate(player);
    setVideoTime(player, 15);
    fireEvent.timeUpdate(player);
    setVideoTime(player, 22);
    fireEvent.timeUpdate(player);
    setVideoTime(player, 25);
    fireEvent.pause(player);
    setVideoTime(player, 600);
    fireEvent.ended(player);

    expect(onProgress).toHaveBeenCalledTimes(4);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      completed: false,
      lessonId: 'lesson-1',
      positionSeconds: 12,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      completed: false,
      lessonId: 'lesson-1',
      positionSeconds: 22,
    });
    expect(onProgress).toHaveBeenNthCalledWith(3, {
      completed: false,
      lessonId: 'lesson-1',
      positionSeconds: 25,
    });
    expect(onProgress).toHaveBeenNthCalledWith(4, {
      completed: true,
      lessonId: 'lesson-1',
      positionSeconds: 600,
    });
  });
});

function renderLessonVideoPlayer({
  initialPositionSeconds = 0,
  lesson = lessonFixture(),
  onProgress,
}: {
  initialPositionSeconds?: number;
  lesson?: LessonResponse | null;
  onProgress?: (payload: {
    completed: boolean;
    lessonId: string;
    positionSeconds: number;
  }) => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonVideoPlayer
        initialPositionSeconds={initialPositionSeconds}
        lesson={lesson}
        onProgress={onProgress}
      />
    </QueryClientProvider>,
  );
}

function lessonFixture(overrides: Partial<LessonResponse> = {}): LessonResponse {
  return {
    courseId: 'course-1',
    createdAt: '2026-09-08T00:00:00.000Z',
    description: 'Start here',
    durationSeconds: 600,
    id: 'lesson-1',
    mediaAssetId: 'asset-1',
    order: 1,
    title: 'Intro lesson',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

function setVideoTime(element: HTMLElement, currentTime: number): void {
  Object.defineProperty(element, 'currentTime', {
    configurable: true,
    value: currentTime,
    writable: true,
  });
}
