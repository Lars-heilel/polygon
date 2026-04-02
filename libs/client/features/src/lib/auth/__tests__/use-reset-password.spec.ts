import { act, renderHook } from '@testing-library/react';

import { createWrapper } from '../../../test/test-utils';
import { useResetPassword } from '../model/use-reset-password';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockToastSuccess = vi.hoisted(() => vi.fn());
vi.mock('@org/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/shared')>();
  return { ...actual, toast: { ...actual.toast, success: mockToastSuccess } };
});

describe('useResetPassword', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockToastSuccess.mockClear();
  });

  it('shows success toast and navigates to login on success', async () => {
    const { result } = renderHook(() => useResetPassword(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.resetPassword('reset-token', 'NewPassword1!');
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringMatching(/password updated/i));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/auth/login'));
  });
});
