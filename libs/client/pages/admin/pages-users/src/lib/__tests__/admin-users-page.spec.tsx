import userEvent from '@testing-library/user-event';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

import type { AdminUserListItem } from '@org/common';
import { useAdminUsersQuery } from '@org/entities-admin';

import { AdminUsersPage } from '../admin-users-page';

jest.mock('@org/entities-admin', () => ({
  useAdminUsersQuery: jest.fn(),
}));

const mockedUseAdminUsersQuery = jest.mocked(useAdminUsersQuery);

const alice: AdminUserListItem = {
  id: 'user-1',
  name: 'alice',
  displayName: 'Alice A.',
  avatarUrl: null,
  role: 'ADMIN',
  ban: {
    isBanned: false,
    bannedUntil: null,
    banReason: null,
    bannedAt: null,
    bannedBy: null,
  },
};

function renderPage(initialEntry = '/users') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminUsersPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();

  return <output aria-label="Current search">{location.search}</output>;
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedUseAdminUsersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAdminUsersQuery>);
  });

  it('uses the query string for direct search navigation', () => {
    mockedUseAdminUsersQuery.mockReturnValue({
      data: [alice],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAdminUsersQuery>);

    renderPage('/users?query=alice');

    expect(mockedUseAdminUsersQuery).toHaveBeenLastCalledWith('alice');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Search users' }).value).toBe('alice');
    expect(screen.getByRole('link', { name: /Alice A./ }).getAttribute('href')).toBe('/users/user-1');
  });

  it('debounces query submission into the URL', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderPage();

    await user.type(screen.getByRole('textbox', { name: 'Search users' }), 'alice');
    expect(screen.getByLabelText('Current search').textContent).toBe('');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByLabelText('Current search').textContent).toBe('?query=alice');
    jest.useRealTimers();
  });

  it('renders empty, loading, error, and result states', () => {
    const { rerender } = renderPage('/users?query=missing');
    expect(screen.getByText('No users found')).toBeTruthy();

    mockedUseAdminUsersQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAdminUsersQuery>);
    rerender(
      <MemoryRouter initialEntries={['/users?query=missing']}>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toBeTruthy();

    mockedUseAdminUsersQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Search failed'),
    } as unknown as ReturnType<typeof useAdminUsersQuery>);
    rerender(
      <MemoryRouter initialEntries={['/users?query=missing']}>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Could not load users')).toBeTruthy();

    mockedUseAdminUsersQuery.mockReturnValue({
      data: [alice],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAdminUsersQuery>);
    rerender(
      <MemoryRouter initialEntries={['/users?query=alice']}>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('ADMIN')).toBeTruthy();
  });
});
