import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { CLIENT_ROUTES } from '@org/common';

import { AppGuard, GuestGuard, getAuthenticatedGuestRedirect } from './guards';

const mockSessionState = {
  isAuthenticated: false,
  isLoading: false,
};

jest.mock('@org/entities-user', () => ({
  selectIsAuthenticated: (state: typeof mockSessionState) => state.isAuthenticated,
  selectIsSessionLoading: (state: typeof mockSessionState) => state.isLoading,
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

function setSessionState(state: Partial<typeof mockSessionState>) {
  Object.assign(mockSessionState, {
    isAuthenticated: false,
    isLoading: false,
    ...state,
  });
}

function renderGuestRoute(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: CLIENT_ROUTES.auth.login,
        element: <GuestGuard />,
        children: [{ index: true, element: <div>Login page</div> }],
      },
      {
        path: CLIENT_ROUTES.auth.emailVerified,
        element: <GuestGuard />,
        children: [{ index: true, element: <div>Email verified page</div> }],
      },
      { path: CLIENT_ROUTES.chats.root, element: <div>Chats page</div> },
      { path: CLIENT_ROUTES.admin.root, element: <div>Admin placeholder</div> },
    ],
    { initialEntries: [initialPath] },
  );

  return render(<RouterProvider router={router} />);
}

function renderAppRoute(initialPath = CLIENT_ROUTES.chats.root) {
  const router = createMemoryRouter(
    [
      {
        path: CLIENT_ROUTES.chats.root,
        element: <AppGuard />,
        children: [{ index: true, element: <div>Protected chats</div> }],
      },
      { path: CLIENT_ROUTES.auth.login, element: <div>Login page</div> },
    ],
    { initialEntries: [initialPath] },
  );

  return render(<RouterProvider router={router} />);
}

describe('auth route guards', () => {
  afterEach(() => {
    setSessionState({});
  });

  it('redirects authenticated guests away from login to chats', async () => {
    setSessionState({ isAuthenticated: true });

    renderGuestRoute(CLIENT_ROUTES.auth.login);

    expect(await screen.findByText('Chats page')).toBeTruthy();
  });

  it('resolves authenticated guest redirects back to the Admin app from login', () => {
    expect(
      getAuthenticatedGuestRedirect(
        { pathname: CLIENT_ROUTES.auth.login, search: '?from=/admin/' },
        'http://localhost:4200',
      ),
    ).toEqual({ type: 'external', href: 'http://localhost:4300/admin/' });
  });

  it('allows authenticated users to see the email-verified continuation page', async () => {
    setSessionState({ isAuthenticated: true });

    renderGuestRoute(CLIENT_ROUTES.auth.emailVerified);

    expect(await screen.findByText('Email verified page')).toBeTruthy();
  });

  it('redirects unauthenticated users from protected routes to login', async () => {
    setSessionState({ isAuthenticated: false });

    renderAppRoute();

    expect(await screen.findByText('Login page')).toBeTruthy();
  });

  it('allows authenticated users into protected routes', async () => {
    setSessionState({ isAuthenticated: true });

    renderAppRoute();

    expect(await screen.findByText('Protected chats')).toBeTruthy();
  });
});
