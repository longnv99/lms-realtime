import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Search, Trash2, Video } from 'lucide-react';
import type { ListMediaAssetsQuery, MediaAssetListItemResponse } from '@lms/shared';
import { deleteMediaAsset, listMediaAssets } from '../../api/media';
import { EmptyState } from '../../components/EmptyState';
import { LoadingBlock } from '../../components/LoadingBlock';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { getErrorMessage } from '../../lib/errors';

type MediaLibraryPanelProps = {
  currentMediaAssetId?: string | null;
  onAttach: (assetId: string) => void;
};

type AttachedFilter = 'all' | 'unused' | 'attached';

const filterOptions: Array<{ label: string; value: AttachedFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Unused', value: 'unused' },
  { label: 'Attached', value: 'attached' },
];

export function MediaLibraryPanel({ currentMediaAssetId, onAttach }: MediaLibraryPanelProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AttachedFilter>('all');
  const query = useMemo<ListMediaAssetsQuery>(() => {
    const nextQuery: ListMediaAssetsQuery = {};
    if (search.trim()) {
      nextQuery.q = search.trim();
    }
    if (filter === 'unused') {
      nextQuery.attached = false;
    }
    if (filter === 'attached') {
      nextQuery.attached = true;
    }
    return nextQuery;
  }, [filter, search]);

  const assetsQuery = useQuery({
    queryKey: ['media-assets', query],
    queryFn: () => listMediaAssets(query),
  });
  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => deleteMediaAsset(assetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['media-assets'] });
    },
  });
  const items = assetsQuery.data?.items ?? [];

  return (
    <section className="media-library-panel" aria-labelledby="media-library-title">
      <div className="media-library-header">
        <div>
          <h3 id="media-library-title">Media library</h3>
          <p>{items.length ? `${items.length} assets in view` : 'Manage uploaded lesson videos'}</p>
        </div>
        <Badge variant="muted">{assetsQuery.data?.total ?? 0}</Badge>
      </div>

      <div className="media-library-toolbar">
        <label className="media-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search media</span>
          <Input
            aria-label="Search media"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search videos"
            value={search}
          />
        </label>
        <div className="media-filter-group" role="group" aria-label="Media filter">
          {filterOptions.map((option) => (
            <button
              aria-pressed={filter === option.value}
              className="media-filter-button"
              key={option.value}
              onClick={() => setFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {assetsQuery.isLoading && <LoadingBlock height={220} label="Loading media assets" />}
      {assetsQuery.isError && (
        <p className="error-banner" role="alert">
          {getErrorMessage(assetsQuery.error)}
        </p>
      )}
      {deleteMutation.isError && (
        <p className="error-banner" role="alert">
          {getErrorMessage(deleteMutation.error)}
        </p>
      )}
      {!assetsQuery.isLoading && !assetsQuery.isError && items.length === 0 && (
        <EmptyState description="Upload a video from a lesson row." title="No media assets" />
      )}
      {items.length > 0 && (
        <div className="media-asset-list">
          {items.map((asset) => (
            <MediaAssetRow
              asset={asset}
              currentMediaAssetId={currentMediaAssetId}
              isDeleting={deleteMutation.isPending}
              key={asset.id}
              onAttach={onAttach}
              onDelete={(assetId) => deleteMutation.mutate(assetId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MediaAssetRow({
  asset,
  currentMediaAssetId,
  isDeleting,
  onAttach,
  onDelete,
}: {
  asset: MediaAssetListItemResponse;
  currentMediaAssetId?: string | null;
  isDeleting: boolean;
  onAttach: (assetId: string) => void;
  onDelete: (assetId: string) => void;
}) {
  const isAttached = Boolean(asset.lesson);
  const isCurrent = currentMediaAssetId === asset.id;
  const canAttach = asset.status === 'UPLOADED' && !isCurrent;

  return (
    <article className="media-asset-row">
      <span className="media-asset-icon">
        <Video size={17} aria-hidden="true" />
      </span>
      <div className="media-asset-copy">
        <strong>{asset.fileName}</strong>
        <span>{asset.lesson?.title ?? formatBytes(asset.sizeBytes)}</span>
      </div>
      <div className="media-asset-state">
        <Badge variant={asset.status === 'UPLOADED' ? 'success' : 'muted'}>{asset.status}</Badge>
        {isCurrent && <Badge variant="live">Current</Badge>}
      </div>
      <TooltipProvider>
        <div className="media-asset-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`Attach ${asset.fileName}`}
                className="course-action"
                disabled={!canAttach}
                onClick={() => onAttach(asset.id)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Link2 aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isCurrent ? 'Attached to this lesson' : 'Attach media'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`Delete ${asset.fileName}`}
                className="course-action"
                disabled={isAttached || isDeleting}
                onClick={() => onDelete(asset.id)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isAttached ? 'Detach before deleting' : 'Delete media'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </article>
  );
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(Math.round(sizeBytes / 1024), 1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
