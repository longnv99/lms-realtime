import { Bell, BookOpen, LayoutDashboard, LogIn, Moon, Radio, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { checkHealth } from '../api/client';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { StatusBadge } from '../components/StatusBadge';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProductShell />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthEntry />} />
        <Route path="/courses" element={<CoursesPlaceholder />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}

function ProductShell() {
  const location = useLocation();

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div>
          <div className="brand-mark">LR</div>
          <h1 className="sidebar-title">LMS Realtime</h1>
          <p className="sidebar-copy">Live class, quiz, and course operations in one workspace.</p>
        </div>
        <nav className="sidebar-nav">
          <Link
            aria-current={location.pathname === '/courses' ? 'page' : undefined}
            className="sidebar-link"
            to="/courses"
          >
            <LayoutDashboard size={18} aria-hidden="true" />
            Courses
          </Link>
          <Link
            aria-current={location.pathname.includes('/sessions') ? 'page' : undefined}
            className="sidebar-link"
            to="/courses"
          >
            <Radio size={18} aria-hidden="true" />
            Live sessions
          </Link>
        </nav>
      </aside>
      <section className="main-column">
        <header className="topbar">
          <BackendStatus />
          <div className="topbar-actions">
            <Button aria-label="Search" icon={<Search size={18} />} iconOnly variant="ghost" />
            <Button aria-label="Notifications" icon={<Bell size={18} />} iconOnly variant="ghost" />
            <Button aria-label="Toggle theme" icon={<Moon size={18} />} iconOnly variant="ghost" />
          </div>
        </header>
        <Outlet />
      </section>
    </main>
  );
}

function BackendStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    retry: false,
  });

  if (health.isLoading) {
    return <StatusBadge>API checking</StatusBadge>;
  }

  if (health.isError) {
    return <StatusBadge tone="muted">API offline</StatusBadge>;
  }

  return <StatusBadge tone="success">{health.data?.status ?? 'API online'}</StatusBadge>;
}

function AuthEntry() {
  return (
    <div className="page">
      <section className="page-header">
        <StatusBadge tone="live">Portfolio demo</StatusBadge>
        <h2 className="page-title">Run the live classroom.</h2>
        <p className="page-description">
          Sign in as instructor or student to manage courses, enter live sessions, chat, and run
          realtime quizzes.
        </p>
      </section>
      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Access</h3>
            <StatusBadge>Seed ready</StatusBadge>
          </div>
          <div className="panel-body">
            <div className="toolbar">
              <Button icon={<LogIn size={18} />}>Dang nhap</Button>
              <Button variant="secondary">Tao tai khoan</Button>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Today</h3>
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div className="panel-body">
            <LoadingBlock height={132} label="Loading workspace preview" />
          </div>
        </div>
      </section>
    </div>
  );
}

function CoursesPlaceholder() {
  return (
    <div className="page">
      <EmptyState
        description="Course catalog, lesson panels, and live session controls arrive in the next P4a task."
        title="Course workspace"
      />
    </div>
  );
}
