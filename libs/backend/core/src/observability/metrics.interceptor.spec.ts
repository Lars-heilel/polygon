import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import { MetricsInterceptor } from './metrics.interceptor';
import type { MetricsService } from './metrics.service';

function createHttpContext(request: unknown, response: unknown): ExecutionContext {
  return {
    getType: jest.fn(() => 'http'),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => request),
      getResponse: jest.fn(() => response),
    })),
  } as unknown as ExecutionContext;
}

function createNext(): CallHandler {
  return {
    handle: jest.fn(() => of('ok')),
  };
}

describe('MetricsInterceptor', () => {
  it('records the Express route template when route metadata is available', async () => {
    const metrics = {
      recordHttpRequest: jest.fn(),
    } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);

    await lastValueFrom(
      interceptor.intercept(
        createHttpContext(
          { method: 'GET', path: '/api/users/real-user-id', route: { path: '/api/users/:id' } },
          { statusCode: 200 },
        ),
        createNext(),
      ),
    );

    expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/api/users/:id',
      200,
      expect.any(Number),
    );
  });

  it('does not use raw request paths when route metadata is unavailable', async () => {
    const metrics = {
      recordHttpRequest: jest.fn(),
    } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);

    await lastValueFrom(
      interceptor.intercept(
        createHttpContext({ method: 'GET', path: '/api/users/real-user-id' }, { statusCode: 404 }),
        createNext(),
      ),
    );

    expect(metrics.recordHttpRequest).toHaveBeenCalledWith('GET', 'unknown', 404, expect.any(Number));
  });
});
