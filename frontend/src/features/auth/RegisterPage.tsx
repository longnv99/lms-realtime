import { BookOpenCheck, GraduationCap, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const tokens = await register({ email, name, password });
      loginSuccess(tokens);
      navigate('/courses', { replace: true });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-shell auth-shell-register">
        <form className="auth-form-panel" onSubmit={onSubmit}>
          <div className="auth-brand-row">
            <span className="auth-logo">LR</span>
            <span>LMS Realtime</span>
          </div>
          <div className="auth-heading">
            <StatusBadge>New workspace</StatusBadge>
            <h1>Create your classroom account</h1>
            <p>Start with a student account, then use instructor roles for authoring workflows.</p>
          </div>
          <div className="auth-form">
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <Field
              autoComplete="name"
              label="Display name"
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
              label="Password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <Button disabled={submitting} icon={<UserPlus size={18} />} type="submit">
              {submitting ? 'Creating account' : 'Create account'}
            </Button>
          </div>
          <p className="auth-switch">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </form>
        <aside className="auth-visual-panel" aria-label="Workspace overview">
          <div className="auth-visual-header">
            <GraduationCap size={22} aria-hidden="true" />
            <div>
              <h2>Course-first workspace</h2>
              <p>Accounts enter the same dark console used by instructors and students.</p>
            </div>
          </div>
          <div className="auth-stat-grid">
            <div>
              <strong>Role</strong>
              <span>student ready</span>
            </div>
            <div>
              <strong>Live</strong>
              <span>sessions</span>
            </div>
            <div>
              <strong>Quiz</strong>
              <span>responses</span>
            </div>
          </div>
          <div className="auth-flow-list">
            <span>
              <BookOpenCheck size={16} aria-hidden="true" />
              Browse courses
            </span>
            <span>
              <BookOpenCheck size={16} aria-hidden="true" />
              Join live rooms
            </span>
            <span>
              <BookOpenCheck size={16} aria-hidden="true" />
              Submit quiz answers
            </span>
          </div>
        </aside>
      </section>
    </div>
  );
}
