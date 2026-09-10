import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import { API_ROUTES } from '@org/common';
import { adminKeys } from '@org/entities-admin';
import { authedFetch, toast } from '@org/shared';

import { AdminBanDialog } from '../admin-ban-dialog';

jest.mock('@org/shared', () => ({
  ...jest.requireActual('@org/shared'),
  authedFetch: jest.fn(),
}));

const mockedAuthedFetch = jest.mocked(authedFetch);
const mockedToast = jest.mocked(toast);

function renderDialog(options: { isBanned?: boolean; onClose?: jest.Mock } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const onClose = options.onClose ?? jest.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <AdminBanDialog
        isOpen
        isBanned={options.isBanned ?? false}
        onClose={onClose}
        userId="user-1"
      />
    </QueryClientProvider>,
  );

  return { invalidateSpy, onClose };
}

describe('AdminBanDialog', () => {
  beforeEach(() => {
    mockedAuthedFetch.mockReset();
    mockedAuthedFetch.mockResolvedValue(undefined);
    mockedToast.error.mockClear();
    mockedToast.success.mockClear();
  });

  it('submits preset duration and reason without a custom reason', async () => {
    const user = userEvent.setup();

    renderDialog();

    await user.selectOptions(screen.getByLabelText('Duration'), 'ONE_DAY');
    await user.selectOptions(screen.getByLabelText('Reason'), 'SPAM');
    await user.click(screen.getByRole('button', { name: 'Ban user' }));

    await waitFor(() => {
      expect(mockedAuthedFetch).toHaveBeenCalledWith(API_ROUTES.admin.ban('user-1'), {
        body: JSON.stringify({ duration: 'ONE_DAY', reason: 'SPAM' }),
        method: 'POST',
      });
    });
  });

  it('shows the custom reason field only for CUSTOM and validates 5/500 characters', async () => {
    const user = userEvent.setup();

    renderDialog();

    expect(screen.queryByLabelText('Custom reason')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Reason'), 'CUSTOM');
    expect(screen.getByLabelText('Custom reason')).toBeTruthy();

    await user.type(screen.getByLabelText('Custom reason'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Ban user' }));
    expect(await screen.findByText('Custom reason must contain at least 5 characters')).toBeTruthy();

    await user.clear(screen.getByRole('textbox', { name: /Custom reason/ }));
    await user.type(screen.getByRole('textbox', { name: /Custom reason/ }), 'a'.repeat(501));
    await user.click(screen.getByRole('button', { name: 'Ban user' }));
    expect(await screen.findByText('Custom reason must contain at most 500 characters')).toBeTruthy();
  });

  it('trims custom reason, invalidates admin queries, closes, and shows a toast', async () => {
    const user = userEvent.setup();
    const { invalidateSpy, onClose } = renderDialog();

    await user.selectOptions(screen.getByLabelText('Reason'), 'CUSTOM');
    await user.type(screen.getByLabelText('Custom reason'), '  repeated spam  ');
    await user.click(screen.getByRole('button', { name: 'Ban user' }));

    await waitFor(() => {
      expect(mockedAuthedFetch).toHaveBeenCalledWith(API_ROUTES.admin.ban('user-1'), {
        body: JSON.stringify({ duration: 'ONE_HOUR', reason: 'CUSTOM', customReason: 'repeated spam' }),
        method: 'POST',
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.all });
    expect(onClose).toHaveBeenCalled();
    expect(mockedToast.success).toHaveBeenCalledWith('User banned');
  });

  it('shows server errors and re-enables actions', async () => {
    const user = userEvent.setup();
    mockedAuthedFetch.mockRejectedValueOnce(new Error('boom'));

    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Ban user' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Could not update ban');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Ban user' }).disabled).toBe(false);
    expect(mockedToast.error).toHaveBeenCalledWith('Could not update ban');
  });

  it('disables actions while a ban request is pending', async () => {
    const user = userEvent.setup();
    mockedAuthedFetch.mockImplementationOnce(() => new Promise(() => undefined));

    renderDialog();

    await user.selectOptions(screen.getByLabelText('Reason'), 'CUSTOM');
    await user.type(screen.getByLabelText('Custom reason'), 'valid custom');
    await user.click(screen.getByRole('button', { name: 'Ban user' }));

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Ban user' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Custom reason' }).disabled).toBe(
      true,
    );
  });

  it('unbans users and invalidates all admin queries', async () => {
    const user = userEvent.setup();
    const { invalidateSpy, onClose } = renderDialog({ isBanned: true });

    await user.click(screen.getByRole('button', { name: 'Unban user' }));

    await waitFor(() => {
      expect(mockedAuthedFetch).toHaveBeenCalledWith(API_ROUTES.admin.ban('user-1'), {
        method: 'DELETE',
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.all });
    expect(onClose).toHaveBeenCalled();
    expect(mockedToast.success).toHaveBeenCalledWith('User unbanned');
  });
});
