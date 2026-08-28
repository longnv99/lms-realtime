import { LogIn } from 'lucide-react';
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
    <div className="page auth-page">
      <section className="page-header">
        <StatusBadge tone="live">Portfolio demo</StatusBadge>
        <h2 className="page-title">Run the live classroom.</h2>
        <p className="page-description">
          Sign in as instructor or student to manage courses, enter live sessions, chat, and run
          realtime quizzes.
        </p>
      </section>
      <section className="auth-grid">
        <form className="panel auth-card" onSubmit={onSubmit}>
          <div className="panel-header">
            <h3 className="panel-title">Access</h3>
            <StatusBadge>Seed ready</StatusBadge>
          </div>
          <div className="panel-body auth-form">
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
              label="Mat khau"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <div className="toolbar">
              <Button disabled={submitting} icon={<LogIn size={18} />} type="submit">
                {submitting ? 'Dang xu ly' : 'Dang nhap'}
              </Button>
              <Link className="button button-secondary" to="/register">
                Tao tai khoan
              </Link>
            </div>
          </div>
        </form>
        <aside className="panel auth-notes" aria-label="Seed accounts">
          <div className="panel-header">
            <h3 className="panel-title">Seed accounts</h3>
          </div>
          <div className="panel-body seed-list">
            <code>instructor@example.com</code>
            <code>student@example.com</code>
            <code>student2@example.com</code>
          </div>
        </aside>
      </section>
    </div>
  );
}
