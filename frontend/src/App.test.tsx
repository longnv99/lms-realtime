import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders heading and check button', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /LMS Realtime/i })).toBeInTheDocument();
    expect(screen.getByTestId('check-health')).toBeInTheDocument();
    expect(screen.getByTestId('check-health')).toHaveTextContent(/Kiểm tra backend/i);
  });

  it('does not show health result before clicking', () => {
    render(<App />);
    expect(screen.queryByTestId('health-result')).not.toBeInTheDocument();
  });
});
