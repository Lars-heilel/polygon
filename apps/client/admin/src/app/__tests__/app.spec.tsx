import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

import App from '../app';

jest.mock('@org/entities-user', () => ({
  selectIsAuthenticated: (state: { isAuthenticated: boolean }) => state.isAuthenticated,
  selectIsSessionLoading: (state: { isLoading: boolean }) => state.isLoading,
  useMeQuery: () => ({
    data: { id: 'me', role: 'ADMIN' },
    isLoading: false,
  }),
  useSessionStore: (selector: (state: { isAuthenticated: boolean; isLoading: boolean }) => unknown) =>
    selector({ isAuthenticated: true, isLoading: false }),
}));

jest.mock('@org/shared', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Heading: ({ as, children }: { as?: 'h1' | 'h2'; children: React.ReactNode }) => {
    const Component = as ?? 'h2';

    return <Component>{children}</Component>;
  },
  Input: ({
    label,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
    <label>
      {label}
      <input {...props} />
    </label>
  ),
  Spinner: () => <div role="status">Loading</div>,
  Text: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

jest.mock('../providers', () => ({
  Providers: ({ children }: { children: ReactNode }) => children,
}));

describe('Admin app shell', () => {
  it('renders the admin console shell', () => {
    window.history.pushState({}, '', '/admin/');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Admin console' })).toBeTruthy();
  });
});
