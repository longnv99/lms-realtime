import { Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCourse } from '../../api/courses';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { getErrorMessage } from '../../lib/errors';

export function CourseEditorPanel() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createCourse,
    onError: (caught) => setError(getErrorMessage(caught)),
    onSuccess: async () => {
      setTitle('');
      setSlug('');
      setDescription('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      description: description || undefined,
      slug,
      title,
    });
  }

  return (
    <form className="panel course-editor" onSubmit={onSubmit}>
      <div className="panel-header">
        <h3 className="panel-title">Instructor tools</h3>
      </div>
      <div className="panel-body auth-form">
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <Field
          label="Ten khoa hoc"
          name="course-title"
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
        <Field
          label="Slug"
          name="course-slug"
          onChange={(event) => setSlug(event.target.value)}
          required
          value={slug}
        />
        <Field
          label="Mo ta"
          name="course-description"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <Button disabled={createMutation.isPending} icon={<Plus size={18} />} type="submit">
          {createMutation.isPending ? 'Dang tao' : 'Tao khoa hoc'}
        </Button>
      </div>
    </form>
  );
}
