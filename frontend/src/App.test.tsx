import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders the product shell and auth entry route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /LMS Realtime/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dang nhap/i })).toBeInTheDocument();
  });

  it('toggles the document theme from the shell action', () => {
    render(<App />);

    const toggle = screen.getByRole('button', { name: /switch to dark theme/i });
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    fireEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
