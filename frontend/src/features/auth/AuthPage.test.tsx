import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '../../api/auth';
import { LoginPage } from './LoginPage';
import { useAuthStore } from './auth.store';

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

const mockedLogin = vi.mocked(login);

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
    mockedLogin.mockReset();
  });

  it('signs in and navigates to courses', async () => {
    mockedLogin.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        email: 'instructor@example.com',
        id: 'user-1',
        name: 'Instructor',
        role: 'INSTRUCTOR',
      },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/courses" element={<h1>Courses reached</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'instructor@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Courses reached/i })).toBeInTheDocument();
    });
    expect(useAuthStore.getState().accessToken).toBe('access-token');
  });
});
