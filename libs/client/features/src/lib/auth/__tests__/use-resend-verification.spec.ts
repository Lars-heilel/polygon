import { act, renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { server } from '../../../test/server';
import { createWrapper } from '../../../test/test-utils';
import { useResendVerification } from '../model/use-resend-verification';

describe('useResendVerification', () => {
  it('sets status to success on successful resend', async () => {
    const { result } = renderHook(() => useResendVerification(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.resend('user@example.com');
    });

    expect(result.current.status).toBe('success');
  });

  it('sets status to rate-limited on 429', async () => {
    server.use(
      http.post('/api/auth/resend-verification', () =>
        HttpResponse.json({ message: 'Too many requests' }, { status: 429 }),
      ),
    );

    const { result } = renderHook(() => useResendVerification(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.resend('user@example.com');
    });

    expect(result.current.status).toBe('rate-limited');
  });

  it('sets status to error on server failure', async () => {
    server.use(
      http.post('/api/auth/resend-verification', () =>
        HttpResponse.json({ message: 'Internal error' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useResendVerification(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.resend('user@example.com');
    });

    expect(result.current.status).toBe('error');
  });

  it('resets status to idle on new call', async () => {
    server.use(
      http.post(
        '/api/auth/resend-verification',
        () => HttpResponse.json({ message: 'Too many requests' }, { status: 429 }),
        { once: true },
      ),
    );

    const { result } = renderHook(() => useResendVerification(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.resend('user@example.com');
    });
    expect(result.current.status).toBe('rate-limited');

    await act(async () => {
      await result.current.resend('user@example.com');
    });

    expect(result.current.status).toBe('success');
  });
});
