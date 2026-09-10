import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonNoteResponse } from '@lms/shared';
import {
  createLessonNote,
  deleteLessonNote,
  listLessonNotes,
  updateLessonNote,
} from '../../api/learning';
import { LessonNotesPanel } from './LessonNotesPanel';

vi.mock('../../api/learning', () => ({
  createLessonNote: vi.fn(),
  deleteLessonNote: vi.fn(),
  listLessonNotes: vi.fn(),
  updateLessonNote: vi.fn(),
}));

const mockedCreateLessonNote = vi.mocked(createLessonNote);
const mockedDeleteLessonNote = vi.mocked(deleteLessonNote);
const mockedListLessonNotes = vi.mocked(listLessonNotes);
const mockedUpdateLessonNote = vi.mocked(updateLessonNote);

describe('LessonNotesPanel', () => {
  beforeEach(() => {
    mockedCreateLessonNote.mockReset();
    mockedDeleteLessonNote.mockReset();
    mockedListLessonNotes.mockReset();
    mockedUpdateLessonNote.mockReset();
    mockedListLessonNotes.mockResolvedValue(notesFixture());
    mockedCreateLessonNote.mockImplementation(async (_lessonId, input) => ({
      ...notesFixture()[0],
      body: input.body,
      positionSeconds: input.positionSeconds ?? null,
    }));
    mockedUpdateLessonNote.mockImplementation(async (noteId, input) => ({
      ...notesFixture()[0],
      id: noteId,
      body: input.body,
      positionSeconds: input.positionSeconds ?? null,
    }));
    mockedDeleteLessonNote.mockResolvedValue();
  });

  it('renders notes and creates a note for the current playback position', async () => {
    renderPanel();

    expect(await screen.findByText('Remember the live attendance threshold.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('New note'), { target: { value: 'Rewatch this demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => {
      expect(mockedCreateLessonNote).toHaveBeenCalledWith('lesson-1', {
        body: 'Rewatch this demo',
        positionSeconds: 125,
      });
    });
  });

  it('enters edit mode and deletes an existing note', async () => {
    renderPanel();

    expect(await screen.findByText('Remember the live attendance threshold.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
    fireEvent.change(screen.getByLabelText('Edit note body'), {
      target: { value: 'Updated private note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockedUpdateLessonNote).toHaveBeenCalledWith('note-1', {
        body: 'Updated private note',
        positionSeconds: 120,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));

    await waitFor(() => {
      expect(mockedDeleteLessonNote).toHaveBeenCalledWith('note-1');
    });
  });
});

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonNotesPanel currentPositionSeconds={125} lessonId="lesson-1" />
    </QueryClientProvider>,
  );
}

function notesFixture(): LessonNoteResponse[] {
  return [
    {
      body: 'Remember the live attendance threshold.',
      createdAt: '2026-09-09T09:10:00.000Z',
      id: 'note-1',
      lessonId: 'lesson-1',
      positionSeconds: 120,
      updatedAt: '2026-09-09T09:15:00.000Z',
      userId: 'user-1',
    },
  ];
}
