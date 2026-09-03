import { Activity, BookOpenCheck, LogIn } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { StatusBadge } from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { useAuthStore } from './auth.store';

export function LoginPage() {
  const loginSuccess = useAuthStore((state) => state.loginSuccess);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const tokens = await login({ email, password });
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
      <section className="auth-shell">
        <form className="auth-form-panel" onSubmit={onSubmit}>
          <div className="auth-brand-row">
            <span className="auth-logo">LR</span>
            <span>LMS Realtime</span>
          </div>
          <div className="auth-heading">
            <StatusBadge tone="live">Realtime LMS</StatusBadge>
            <h1>Sign in to your workspace</h1>
            <p>
              Manage courses, live sessions, chat, and realtime quizzes from one focused console.
            </p>
          </div>
          <div className="auth-form">
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
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
              autoComplete="current-password"
              label="Password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <Button disabled={submitting} icon={<LogIn size={18} />} type="submit">
              {submitting ? 'Signing in' : 'Sign in'}
            </Button>
          </div>
          <p className="auth-switch">
            Need an account? <Link to="/register">Create account</Link>
          </p>
        </form>
        <aside className="auth-visual-panel" aria-label="Seed accounts">
          <div className="auth-visual-header">
            <BookOpenCheck size={22} aria-hidden="true" />
            <div>
              <h2>Live cohort command</h2>
              <p>Seed data is ready for local instructor and student flows.</p>
            </div>
          </div>
          <div className="auth-stat-grid">
            <div>
              <strong>3</strong>
              <span>demo users</span>
            </div>
            <div>
              <strong>1</strong>
              <span>seed course</span>
            </div>
            <div>
              <strong>API</strong>
              <span>local ready</span>
            </div>
          </div>
          <div className="seed-list">
            <code>instructor@example.com</code>
            <code>student@example.com</code>
            <code>student2@example.com</code>
          </div>
          <div className="auth-live-strip">
            <Activity size={18} aria-hidden="true" />
            <span>Realtime classroom preview</span>
          </div>
        </aside>
      </section>
    </div>
  );
}
