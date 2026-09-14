import { useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Library, Unlink, UploadCloud } from 'lucide-react';
import type { LessonResponse } from '@lms/shared';
import { completeMediaUpload, createMediaUpload } from '../../api/media';
import { updateLessonMedia } from '../../api/lessons';
import { Button } from '../../components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { getErrorMessage } from '../../lib/errors';
import { MediaLibraryPanel } from '../media/MediaLibraryPanel';

type LessonMediaUploadProps = {
  courseId: string;
  lesson: LessonResponse;
};

const allowedVideoTypes = new Set(['video/mp4', 'video/webm']);

export function LessonMediaUpload({ courseId, lesson }: LessonMediaUploadProps) {
  const queryClient = useQueryClient();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const invalidateMediaQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lessons', courseId] }),
      queryClient.invalidateQueries({ queryKey: ['media-assets'] }),
    ]);
  };
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAndAttachVideo(lesson.id, file),
    onSuccess: invalidateMediaQueries,
  });
  const attachMutation = useMutation({
    mutationFn: (mediaAssetId: string) => updateLessonMedia(lesson.id, { mediaAssetId }),
    onSuccess: async () => {
      setIsLibraryOpen(false);
      await invalidateMediaQueries();
    },
  });
  const detachMutation = useMutation({
    mutationFn: () => updateLessonMedia(lesson.id, { mediaAssetId: null }),
    onSuccess: invalidateMediaQueries,
  });
  const inputId = `lesson-video-upload-${lesson.id}`;
  const error =
    validationError ??
    (uploadMutation.error ? getErrorMessage(uploadMutation.error) : null) ??
    (attachMutation.error ? getErrorMessage(attachMutation.error) : null) ??
    (detachMutation.error ? getErrorMessage(detachMutation.error) : null);
  const isBusy = uploadMutation.isPending || attachMutation.isPending || detachMutation.isPending;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!allowedVideoTypes.has(file.type)) {
      setValidationError('Only MP4 or WebM video files are supported.');
      return;
    }

    setValidationError(null);
    uploadMutation.mutate(file);
  }

  return (
    <div className="lesson-upload">
      <div className="lesson-media-actions">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <label
                aria-disabled={isBusy}
                className="course-action lesson-upload-control"
                htmlFor={inputId}
                title="Upload video"
              >
                <UploadCloud size={18} aria-hidden="true" />
                <span className="sr-only">Upload video for {lesson.title}</span>
              </label>
            </TooltipTrigger>
            <TooltipContent>
              {lesson.mediaAssetId ? 'Replace video' : 'Upload video'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Sheet open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={`Open media library for ${lesson.title}`}
                  className="course-action"
                  disabled={isBusy}
                  onClick={() => setIsLibraryOpen(true)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Library aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach media</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <SheetContent
            className="media-library-sheet w-[min(560px,calc(100vw-20px))] max-w-none sm:max-w-none"
            showCloseButton
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Attach media</SheetTitle>
              <SheetDescription>Attach an uploaded video to this lesson.</SheetDescription>
            </SheetHeader>
            <MediaLibraryPanel
              currentMediaAssetId={lesson.mediaAssetId}
              onAttach={(assetId) => attachMutation.mutate(assetId)}
            />
          </SheetContent>
        </Sheet>
        {lesson.mediaAssetId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={`Detach video for ${lesson.title}`}
                  className="course-action"
                  disabled={isBusy}
                  onClick={() => detachMutation.mutate()}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Unlink aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Detach video</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <input
        accept="video/mp4,video/webm"
        aria-label={`Upload video for ${lesson.title}`}
        className="sr-only"
        disabled={isBusy}
        id={inputId}
        onChange={handleFileChange}
        type="file"
      />
      {uploadMutation.isPending && <span className="lesson-upload-state">Upload pending</span>}
      {error && (
        <p className="field-error lesson-upload-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

async function uploadAndAttachVideo(lessonId: string, file: File): Promise<void> {
  const upload = await createMediaUpload({
    contentType: file.type as 'video/mp4' | 'video/webm',
    fileName: file.name,
    sizeBytes: file.size,
  });
  const response = await fetch(upload.uploadUrl, {
    body: file,
    headers: { 'Content-Type': file.type },
    method: 'PUT',
  });

  if (!response.ok) {
    throw new Error('Video upload failed.');
  }

  await completeMediaUpload(upload.assetId);
  await updateLessonMedia(lessonId, { mediaAssetId: upload.assetId });
}
