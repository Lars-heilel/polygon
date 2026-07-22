import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import { useCreateDirectChatMutation } from '@org/entities-chat';
import { UserProfileModal } from '@org/features-user-profile';
import { authedFetch } from '@org/shared';

const mockNavigate = jest.fn();

jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@org/entities-chat', () => ({
  useCreateDirectChatMutation: jest.fn(),
}));

jest.mock('@org/features-user-profile/ui/profile-media-panel', () => ({
  ProfileMediaPanel: ({ chatId }: { chatId: string }) => <div data-testid="profile-media-panel">{chatId}</div>,
}));

const profile = {
  id: 'user-1',
  name: 'alice',
  displayName: 'Alice Doe',
  email: 'alice@example.com',
  avatarUrl: null,
  bio: 'Product designer',
  role: 'USER',
};

const mockedAuthedFetch = jest.mocked(authedFetch);
const mockedUseCreateDirectChatMutation = jest.mocked(useCreateDirectChatMutation);

function renderProfileModal(props: Partial<Parameters<typeof UserProfileModal>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <UserProfileModal
        userId="user-1"
        onClose={jest.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe('UserProfileModal', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockedAuthedFetch.mockReset();
    mockedUseCreateDirectChatMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({ id: 'chat-new' }),
    } as never);
  });

  it('uses the shared dialog shell and closes from the shared close button', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    mockedAuthedFetch.mockResolvedValue(profile);

    renderProfileModal({ onClose });

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders loading, error, and loaded profile states', async () => {
    mockedAuthedFetch.mockImplementationOnce(() => new Promise(() => undefined));
    renderProfileModal();
    expect(screen.getByTestId('profile-modal-loading')).toBeTruthy();

    mockedAuthedFetch.mockReset();
    mockedAuthedFetch.mockRejectedValueOnce(new Error('boom'));
    renderProfileModal();
    expect(await screen.findByText('Failed to load profile')).toBeTruthy();

    mockedAuthedFetch.mockReset();
    mockedAuthedFetch.mockResolvedValueOnce(profile);
    renderProfileModal();
    expect(await screen.findByRole('heading', { name: 'Alice Doe' })).toBeTruthy();
    expect(screen.getByText('@alice')).toBeTruthy();
    expect(screen.getByText('Product designer')).toBeTruthy();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  it('switches to media tab only when chat media exists', async () => {
    const user = userEvent.setup();
    mockedAuthedFetch.mockResolvedValue(profile);

    renderProfileModal({ chatId: 'chat-1' });

    await screen.findByRole('heading', { name: 'Alice Doe' });
    await user.click(screen.getByRole('button', { name: 'Media' }));
    expect(screen.getByTestId('profile-media-panel').textContent).toBe('chat-1');
  });

  it('exposes avatar history action without owning the avatar carousel feature', async () => {
    const user = userEvent.setup();
    const onAvatarClick = jest.fn();
    mockedAuthedFetch.mockResolvedValue(profile);

    renderProfileModal({ onAvatarClick });

    await user.click(await screen.findByRole('button', { name: 'Open avatar history' }));
    expect(onAvatarClick).toHaveBeenCalledTimes(1);
  });

  it('creates a direct chat from the primary action', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const mutateAsync = jest.fn().mockResolvedValue({ id: 'chat-new' });
    mockedUseCreateDirectChatMutation.mockReturnValue({ mutateAsync } as never);
    mockedAuthedFetch.mockResolvedValue(profile);

    renderProfileModal({ onClose, showSendButton: true });

    await user.click(await screen.findByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ targetUserId: 'user-1' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/chats/chat-new');
  });
});
