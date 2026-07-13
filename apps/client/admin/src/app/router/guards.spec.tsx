import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router';

import type { Role } from '@org/common';

import { getAdminLoginUrl, redirectToAdminLogin } from './guards';
import { createAdminRouter } from './router';

const sessionState = {
  isAuthenticated: false,
  isLoading: false,
  role: 'USER' as Role,
  meLoading: false,
};

jest.mock('@org/entities-user', () => ({
  selectIsAuthenticated: (state: typeof sessionState) => state.isAuthenticated,
  selectIsSessionLoading: (state: typeof sessionState) => state.isLoading,
  useMeQuery: () => ({
    data: { id: 'me', role: sessionState.role },
    isLoading: sessionState.meLoading,
  }),
  useSessionStore: (selector: (state: typeof sessionState) => unknown) => selector(sessionState),
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

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  render(<RouterProvider router={createAdminRouter()} />);
}

describe('Admin route guards', () => {
  beforeEach(() => {
    sessionState.isAuthenticated = false;
    sessionState.isLoading = false;
    sessionState.role = 'USER';
    sessionState.meLoading = false;
  });

  it('points from the admin dev server to the messenger login route', () => {
    expect(getAdminLoginUrl('http://localhost:4300')).toBe(
      'http://localhost:4200/auth/login?from=/admin/',
    );
    expect(getAdminLoginUrl('http://127.0.0.1:4300')).toBe(
      'http://127.0.0.1:4200/auth/login?from=/admin/',
    );
  });

  it('uses the same-origin login route outside the split dev server', () => {
    expect(getAdminLoginUrl('https://demo.example.com')).toBe('/auth/login?from=/admin/');
  });

  it('assigns the external login URL with the Admin return location', () => {
    const location = { assign: jest.fn() };

    redirectToAdminLogin(location, 'http://localhost:4300');

    expect(location.assign).toHaveBeenCalledWith('http://localhost:4200/auth/login?from=/admin/');
  });

  it('uses full navigation to the login app when unauthenticated', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    renderAt('/admin/');

    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Not implemented: navigation (except hash changes)',
      }),
    );

    consoleError.mockRestore();
  });

  it.each<Role>(['USER', 'MODERATOR'])('redirects %s users to the Admin 404 route', async (role) => {
    sessionState.isAuthenticated = true;
    sessionState.role = role;

    renderAt('/admin/');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin/404');
    });
    expect(screen.getByRole('heading', { name: 'Admin page not found' })).toBeTruthy();
  });

  it.each<Role>(['CREATOR', 'ADMIN'])('allows %s users into the Admin app', async (role) => {
    sessionState.isAuthenticated = true;
    sessionState.role = role;

    renderAt('/admin/');

    expect(await screen.findByRole('heading', { name: 'Admin console' })).toBeTruthy();
  });

  it('redirects unknown Admin routes to /admin/404', async () => {
    sessionState.isAuthenticated = true;
    sessionState.role = 'ADMIN';

    renderAt('/admin/does-not-exist');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin/404');
    });
    expect(screen.getByRole('heading', { name: 'Admin page not found' })).toBeTruthy();
  });
});
