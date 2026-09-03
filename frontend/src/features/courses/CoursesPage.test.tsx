import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseResponse } from '@lms/shared';
import { listCourses } from '../../api/courses';
import { useAuthStore } from '../auth/auth.store';
import { CoursesPage } from './CoursesPage';

vi.mock('../../api/courses', () => ({
  createCourse: vi.fn(),
  enrollCourse: vi.fn(),
  listCourses: vi.fn(),
  publishCourse: vi.fn(),
}));

const mockedListCourses = vi.mocked(listCourses);

describe('CoursesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      accessToken: 'token',
      refreshToken: 'refresh-token',
      user: {
        email: 'student@example.com',
        id: 'student-1',
        name: 'Student',
        role: 'STUDENT',
      },
    });
    mockedListCourses.mockReset();
  });

  it('renders published courses and student enrollment action', async () => {
    mockedListCourses.mockResolvedValue([course({ status: 'PUBLISHED' })]);

    renderCoursesPage();

    expect(await screen.findByText('Realtime LMS Foundations')).toBeInTheDocument();
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /enroll/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create course/i })).not.toBeInTheDocument();
  });

  it('renders instructor create and publish tools', async () => {
    useAuthStore.setState({
      user: {
        email: 'instructor@example.com',
        id: 'instructor-1',
        name: 'Instructor',
        role: 'INSTRUCTOR',
      },
    });
    mockedListCourses.mockResolvedValue([course({ status: 'DRAFT' })]);

    renderCoursesPage();

    expect(await screen.findByRole('button', { name: /create course/i })).toBeInTheDocument();
    expect(await screen.findByText('Realtime LMS Foundations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
  });

  it('renders an empty state when no courses exist', async () => {
    mockedListCourses.mockResolvedValue([]);

    renderCoursesPage();

    expect(await screen.findByText(/no courses yet/i)).toBeInTheDocument();
  });
});

function renderCoursesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function course(overrides: Partial<CourseResponse> = {}): CourseResponse {
  return {
    createdAt: '2026-08-28T00:00:00.000Z',
    description: 'Seed course for realtime practice',
    id: 'course-1',
    instructorId: 'instructor-1',
    publishedAt: null,
    slug: 'realtime-lms-foundations',
    status: 'PUBLISHED',
    title: 'Realtime LMS Foundations',
    updatedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  };
}
