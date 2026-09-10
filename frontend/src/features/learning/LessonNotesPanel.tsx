import { useMemo, useState } from 'react';
import { Check, Clock3, Pencil, Plus, StickyNote, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LessonNoteResponse } from '@lms/shared';
import {
  createLessonNote,
  deleteLessonNote,
  listLessonNotes,
  updateLessonNote,
} from '../../api/learning';
import { LoadingBlock } from '../../components/LoadingBlock';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { getErrorMessage } from '../../lib/errors';
import { formatTimestamp } from './LessonTranscriptPanel';

type LessonNotesPanelProps = {
  currentPositionSeconds: number;
  lessonId: string;
};

export function LessonNotesPanel({ currentPositionSeconds, lessonId }: LessonNotesPanelProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const notesQuery = useQuery({
    queryKey: ['lesson-notes', lessonId],
    queryFn: () => listLessonNotes(lessonId),
  });

  const notes = useMemo(
    () =>
      [...(notesQuery.data ?? [])].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      ),
    [notesQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createLessonNote(lessonId, {
        body: draft.trim(),
        positionSeconds: Math.max(0, Math.floor(currentPositionSeconds)),
      }),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['lesson-notes', lessonId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (note: LessonNoteResponse) =>
      updateLessonNote(note.id, {
        body: editDraft.trim(),
        positionSeconds: note.positionSeconds,
      }),
    onSuccess: () => {
      setEditingNoteId(null);
      setEditDraft('');
      void queryClient.invalidateQueries({ queryKey: ['lesson-notes', lessonId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteLessonNote(noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lesson-notes', lessonId] });
    },
  });

  function startEditing(note: LessonNoteResponse) {
    setEditingNoteId(note.id);
    setEditDraft(note.body);
  }

  if (notesQuery.isLoading) {
    return <LoadingBlock height={220} label="Loading notes" />;
  }

  if (notesQuery.isError) {
    return (
      <p className="error-banner" role="alert">
        {getErrorMessage(notesQuery.error)}
      </p>
    );
  }

  return (
    <div className="lesson-notes-panel">
      <form
        className="lesson-note-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) {
            createMutation.mutate();
          }
        }}
      >
        <Textarea
          aria-label="New note"
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Capture a private note..."
          value={draft}
        />
        <div className="lesson-note-composer-footer">
          <span>
            <Clock3 size={13} aria-hidden="true" />
            {formatTimestamp(currentPositionSeconds)}
          </span>
          <Button disabled={!draft.trim() || createMutation.isPending} size="sm" type="submit">
            <Plus size={15} aria-hidden="true" />
            Save note
          </Button>
        </div>
      </form>
      <div className="lesson-notes-list">
        {notes.length === 0 ? (
          <div className="lesson-panel-empty">
            <StickyNote size={18} aria-hidden="true" />
            <span>No notes yet</span>
          </div>
        ) : (
          <TooltipProvider>
            {notes.map((note) => {
              const isEditing = editingNoteId === note.id;

              return (
                <article className="lesson-note-item" key={note.id}>
                  <div className="lesson-note-meta">
                    <span>
                      <Clock3 size={13} aria-hidden="true" />
                      {note.positionSeconds === null
                        ? 'No timestamp'
                        : formatTimestamp(note.positionSeconds)}
                    </span>
                    <div className="lesson-note-actions">
                      {isEditing ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label="Save changes"
                                disabled={!editDraft.trim() || updateMutation.isPending}
                                onClick={() => updateMutation.mutate(note)}
                                size="icon"
                                type="button"
                                variant="ghost"
                              >
                                <Check aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Save changes</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label="Cancel edit"
                                onClick={() => setEditingNoteId(null)}
                                size="icon"
                                type="button"
                                variant="ghost"
                              >
                                <X aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel edit</TooltipContent>
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label="Edit note"
                                onClick={() => startEditing(note)}
                                size="icon"
                                type="button"
                                variant="ghost"
                              >
                                <Pencil aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit note</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                aria-label="Delete note"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(note.id)}
                                size="icon"
                                type="button"
                                variant="ghost"
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete note</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <Textarea
                      aria-label="Edit note body"
                      maxLength={4000}
                      onChange={(event) => setEditDraft(event.target.value)}
                      value={editDraft}
                    />
                  ) : (
                    <p>{note.body}</p>
                  )}
                </article>
              );
            })}
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
