import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { logout } from './api/auth';
import App from './App';
import { ProductShell } from './app/routes';
import { useAuthStore } from './features/auth/auth.store';

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  register: vi.fn(),
}));

vi.mock('./api/notifications', () => ({
  listNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}));

vi.mock('./features/courses/CoursesPage', () => ({
  CoursesPage: () => <h1>Courses dashboard</h1>,
}));

const mockedLogout = vi.mocked(logout);

describe('App shell', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
    mockedLogout.mockReset();
    window.history.pushState({}, '', '/');
  });

  it('renders auth routes without the product sidebar', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/main navigation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live class, quiz/i)).not.toBeInTheDocument();
  });

  it('redirects signed-in users from the root URL to courses', async () => {
    setSignedInShellState();

    render(<App />);

    expect(await screen.findByRole('heading', { name: /courses dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('redirects signed-in users away from login to courses', async () => {
    window.history.pushState({}, '', '/login');
    setSignedInShellState();

    render(<App />);

    expect(await screen.findByRole('heading', { name: /courses dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('locks the product shell to the dark theme', async () => {
    setSignedInShellState();
    renderShell();

    expect(screen.getByText('Shell ready')).toBeInTheDocument();
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
    expect(screen.queryByRole('button', { name: /switch to/i })).not.toBeInTheDocument();
  });

  it('signs out from the product shell and returns to login', async () => {
    mockedLogout.mockResolvedValue(undefined);
    setSignedInShellState();
    renderShell();

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(mockedLogout).toHaveBeenCalledWith('refresh-token');
    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/main navigation/i)).not.toBeInTheDocument();
  });
});

function setSignedInShellState() {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: 'refresh-token',
    user: {
      email: 'instructor@example.com',
      id: 'user-1',
      name: 'Instructor',
      role: 'INSTRUCTOR',
    },
  });
}

function renderShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/courses']}>
        <Routes>
          <Route path="/login" element={<LoginStub />} />
          <Route element={<ProductShell />}>
            <Route path="/courses" element={<div>Shell ready</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LoginStub() {
  return <button type="button">Sign in</button>;
}
