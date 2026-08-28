import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  it('renders the product shell and auth entry route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /LMS Realtime/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dang nhap/i })).toBeInTheDocument();
  });
});
