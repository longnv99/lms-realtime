import { UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { UserRole } from '@lms/shared';
import { register } from '../../api/auth';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { useAuthStore } from './auth.store';

export function RegisterPage() {
  const loginSuccess = useAuthStore((state) => state.loginSuccess);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const tokens = await register({ email, name, password, role });
      loginSuccess(tokens);
      navigate('/courses', { replace: true });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page auth-page">
      <section className="page-header">
        <StatusBadge>New workspace</StatusBadge>
        <h2 className="page-title">Create your classroom account.</h2>
        <p className="page-description">
          Register as a student for course access or as an instructor for authoring workflows.
        </p>
      </section>
      <form className="panel auth-card" onSubmit={onSubmit}>
        <div className="panel-header">
          <h3 className="panel-title">Account details</h3>
        </div>
        <div className="panel-body auth-form">
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <Field
            autoComplete="name"
            label="Ten hien thi"
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          <Field
            autoComplete="email"
            label="Email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <Field
            autoComplete="new-password"
            help="At least 8 characters, including letters and numbers."
            label="Mat khau"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <label className="field" htmlFor="role">
            <span className="field-label">Vai tro</span>
            <select
              className="field-control"
              id="role"
              name="role"
              onChange={(event) => setRole(event.target.value as UserRole)}
              value={role}
            >
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
            </select>
          </label>
          <div className="toolbar">
            <Button disabled={submitting} icon={<UserPlus size={18} />} type="submit">
              {submitting ? 'Dang tao' : 'Tao tai khoan'}
            </Button>
            <Link className="button button-secondary" to="/login">
              Dang nhap
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
