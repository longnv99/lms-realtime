import { useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';
import type { LessonResponse } from '@lms/shared';
import { completeMediaUpload, createMediaUpload } from '../../api/media';
import { updateLesson } from '../../api/lessons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { getErrorMessage } from '../../lib/errors';

type LessonMediaUploadProps = {
  courseId: string;
  lesson: LessonResponse;
};

const allowedVideoTypes = new Set(['video/mp4', 'video/webm']);

export function LessonMediaUpload({ courseId, lesson }: LessonMediaUploadProps) {
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = useState<string | null>(null);
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAndAttachVideo(lesson.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lessons', courseId] });
    },
  });
  const inputId = `lesson-video-upload-${lesson.id}`;
  const error =
    validationError ?? (uploadMutation.error ? getErrorMessage(uploadMutation.error) : null);

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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <label
              aria-disabled={uploadMutation.isPending}
              className="course-action lesson-upload-control"
              htmlFor={inputId}
              title="Upload video"
            >
              <UploadCloud size={18} aria-hidden="true" />
              <span className="sr-only">Upload video for {lesson.title}</span>
            </label>
          </TooltipTrigger>
          <TooltipContent>Upload video</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <input
        accept="video/mp4,video/webm"
        aria-label={`Upload video for ${lesson.title}`}
        className="sr-only"
        disabled={uploadMutation.isPending}
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
  await updateLesson(lessonId, { mediaAssetId: upload.assetId });
}
