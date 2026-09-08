import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonResponse } from '@lms/shared';
import { completeMediaUpload, createMediaUpload } from '../../api/media';
import { createLesson, listLessons, updateLesson } from '../../api/lessons';
import { LessonsPanel } from './LessonsPanel';

vi.mock('../../api/lessons', () => ({
  createLesson: vi.fn(),
  listLessons: vi.fn(),
  updateLesson: vi.fn(),
}));

vi.mock('../../api/media', () => ({
  completeMediaUpload: vi.fn(),
  createMediaUpload: vi.fn(),
}));

const mockedCompleteMediaUpload = vi.mocked(completeMediaUpload);
const mockedCreateLesson = vi.mocked(createLesson);
const mockedCreateMediaUpload = vi.mocked(createMediaUpload);
const mockedListLessons = vi.mocked(listLessons);
const mockedUpdateLesson = vi.mocked(updateLesson);
const fetchMock = vi.fn();

describe('LessonsPanel', () => {
  beforeEach(() => {
    mockedCompleteMediaUpload.mockReset();
    mockedCreateLesson.mockReset();
    mockedCreateMediaUpload.mockReset();
    mockedListLessons.mockReset();
    mockedUpdateLesson.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    mockedListLessons.mockResolvedValue([
      createLessonFixture({ id: 'lesson-1', mediaAssetId: null, title: 'Intro lesson' }),
      createLessonFixture({ id: 'lesson-2', mediaAssetId: 'asset-2', order: 2, title: 'Practice' }),
    ]);
    mockedCreateMediaUpload.mockResolvedValue({
      assetId: 'asset-1',
      expiresInSeconds: 900,
      key: 'videos/asset-1.mp4',
      uploadUrl: 'http://localhost:9000/upload',
    });
    mockedCompleteMediaUpload.mockResolvedValue({
      contentType: 'video/mp4',
      fileName: 'intro.mp4',
      id: 'asset-1',
      key: 'videos/asset-1.mp4',
      status: 'UPLOADED',
    });
    mockedUpdateLesson.mockResolvedValue(
      createLessonFixture({ id: 'lesson-1', mediaAssetId: 'asset-1', title: 'Intro lesson' }),
    );
    fetchMock.mockResolvedValue({ ok: true });
  });

  it('renders instructor upload actions and media states for lessons', async () => {
    renderLessonsPanel({ canManage: true });

    expect(await screen.findByText('Intro lesson')).toBeInTheDocument();
    expect(screen.getByLabelText(/upload video for intro lesson/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload video for practice/i)).toBeInTheDocument();
    expect(screen.getByText('No video')).toBeInTheDocument();
    expect(screen.getByText('Video attached')).toBeInTheDocument();
  });

  it('hides upload actions from students', async () => {
    renderLessonsPanel({ canManage: false });

    expect(await screen.findByText('Intro lesson')).toBeInTheDocument();
    expect(screen.queryByLabelText(/upload video for intro lesson/i)).not.toBeInTheDocument();
  });

  it('uploads selected video files and attaches completed media to the lesson', async () => {
    renderLessonsPanel({ canManage: true });
    const file = new File(['video'], 'intro.mp4', { type: 'video/mp4' });

    await userEvent.upload(await screen.findByLabelText(/upload video for intro lesson/i), file);

    await waitFor(() => {
      expect(mockedCreateMediaUpload).toHaveBeenCalledWith({
        contentType: 'video/mp4',
        fileName: 'intro.mp4',
        sizeBytes: file.size,
      });
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:9000/upload', {
        body: file,
        headers: { 'Content-Type': 'video/mp4' },
        method: 'PUT',
      });
      expect(mockedCompleteMediaUpload).toHaveBeenCalledWith('asset-1');
      expect(mockedUpdateLesson).toHaveBeenCalledWith('lesson-1', { mediaAssetId: 'asset-1' });
    });
  });

  it('rejects non-video files before creating an upload', async () => {
    renderLessonsPanel({ canManage: true });
    const user = userEvent.setup({ applyAccept: false });
    const file = new File(['plain'], 'notes.txt', { type: 'text/plain' });

    await user.upload(await screen.findByLabelText(/upload video for intro lesson/i), file);

    expect(
      await screen.findByText('Only MP4 or WebM video files are supported.'),
    ).toBeInTheDocument();
    expect(mockedCreateMediaUpload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function renderLessonsPanel({ canManage }: { canManage: boolean }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonsPanel canManage={canManage} courseId="course-1" />
    </QueryClientProvider>,
  );
}

function createLessonFixture(overrides: Partial<LessonResponse> = {}): LessonResponse {
  return {
    courseId: 'course-1',
    createdAt: '2026-09-08T00:00:00.000Z',
    description: 'Lesson description',
    durationSeconds: 600,
    id: 'lesson-1',
    mediaAssetId: null,
    order: 1,
    title: 'Lesson',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}
