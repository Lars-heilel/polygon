import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { throwError } from 'rxjs';

import { SEARCH_PATTERNS } from '@org/core';

import { UserGatewayController } from './user.controller';

describe('UserGatewayController', () => {
  it('does not write raw RPC error details to diagnostic logs', async () => {
    const authClient = { send: jest.fn() };
    const userClient = { send: jest.fn() };
    const searchClient = {
      send: jest.fn(() =>
        throwError(() =>
          Object.assign(new Error('User user@example.com failed with token=secret-token'), {
            statusCode: 404,
            response: {
              message: 'User user@example.com failed with token=secret-token',
              userAgent: 'Sensitive User Agent',
            },
          }),
        ),
      ),
      emit: jest.fn(),
    };
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      verbose: jest.fn(),
      warn: jest.fn(),
    };
    const controller = new UserGatewayController(
      authClient as unknown as ClientProxy,
      userClient as unknown as ClientProxy,
      searchClient as unknown as ClientProxy,
    );
    Object.defineProperty(controller, 'logger', { value: logger });

    let thrown: unknown;
    try {
      await controller.getById('user-1');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);

    expect(searchClient.send).toHaveBeenCalledWith(SEARCH_PATTERNS.GET_USER_BY_ID, { id: 'user-1' });
    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain('user@example.com');
    expect(diagnosticPayload).not.toContain('secret-token');
    expect(diagnosticPayload).not.toContain('Sensitive User Agent');
  });
});
