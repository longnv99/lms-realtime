import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaAssetListItemResponse } from '@lms/shared';
import { deleteMediaAsset, listMediaAssets } from '../../api/media';
import { MediaLibraryPanel } from './MediaLibraryPanel';

vi.mock('../../api/media', () => ({
  deleteMediaAsset: vi.fn(),
  listMediaAssets: vi.fn(),
}));

const mockedDeleteMediaAsset = vi.mocked(deleteMediaAsset);
const mockedListMediaAssets = vi.mocked(listMediaAssets);

describe('MediaLibraryPanel', () => {
  beforeEach(() => {
    mockedDeleteMediaAsset.mockReset();
    mockedListMediaAssets.mockReset();
    mockedListMediaAssets.mockResolvedValue({
      items: [
        createAsset({ fileName: 'intro.mp4', id: 'asset-1' }),
        createAsset({
          fileName: 'attached.webm',
          id: 'asset-attached',
          lesson: {
            courseId: 'course-1',
            courseTitle: 'Realtime LMS Foundations',
            id: 'lesson-1',
            title: 'Introduction',
          },
        }),
        createAsset({ fileName: 'unused.webm', id: 'asset-unused' }),
      ],
      limit: 20,
      page: 1,
      total: 3,
    });
    mockedDeleteMediaAsset.mockResolvedValue({ deleted: true });
  });

  it('renders media assets with attach and delete actions', async () => {
    renderMediaLibraryPanel();

    expect(await screen.findByText('Media library')).toBeInTheDocument();
    expect(await screen.findByText('intro.mp4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attach intro.mp4/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete unused.webm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete attached.webm/i })).toBeDisabled();
  });

  it('searches media assets by query text', async () => {
    renderMediaLibraryPanel();

    await userEvent.type(await screen.findByLabelText(/search media/i), 'intro');

    await waitFor(() => {
      expect(mockedListMediaAssets).toHaveBeenCalledWith({ q: 'intro' });
    });
  });

  it('filters unused assets', async () => {
    renderMediaLibraryPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Unused' }));

    await waitFor(() => {
      expect(mockedListMediaAssets).toHaveBeenCalledWith({ attached: false });
    });
  });

  it('attaches and deletes selected assets', async () => {
    const onAttach = vi.fn();
    renderMediaLibraryPanel({ onAttach });

    await userEvent.click(await screen.findByRole('button', { name: /attach intro.mp4/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete unused.webm/i }));

    expect(onAttach).toHaveBeenCalledWith('asset-1');
    await waitFor(() => {
      expect(mockedDeleteMediaAsset).toHaveBeenCalledWith('asset-unused');
    });
  });
});

function renderMediaLibraryPanel({
  onAttach = vi.fn(),
}: { onAttach?: (assetId: string) => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MediaLibraryPanel currentMediaAssetId="asset-current" onAttach={onAttach} />
    </QueryClientProvider>,
  );
}

function createAsset(
  overrides: Partial<MediaAssetListItemResponse> = {},
): MediaAssetListItemResponse {
  return {
    contentType: 'video/mp4',
    createdAt: '2026-09-11T00:00:00.000Z',
    fileName: 'asset.mp4',
    id: 'asset-1',
    key: 'videos/asset-1.mp4',
    lesson: null,
    sizeBytes: 2048,
    status: 'UPLOADED',
    updatedAt: '2026-09-11T00:00:00.000Z',
    uploadedBy: {
      email: 'instructor@example.com',
      id: 'user-1',
      name: 'Instructor',
    },
    ...overrides,
  };
}
