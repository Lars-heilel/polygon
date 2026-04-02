import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EMAIL_PROVIDER } from '@org/core';

import { NotificationService } from './notification.service';

const mockEmail = {
  send: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('https://app.example.com'),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: EMAIL_PROVIDER, useValue: mockEmail },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  // ── sendVerificationEmail ─────────────────────────────────────────

  describe('sendVerificationEmail', () => {
    it('sends email with verification template to the given address', async () => {
      await service.sendVerificationEmail('user@example.com', 'tok123');

      expect(mockEmail.send).toHaveBeenCalledTimes(1);
      expect(mockEmail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.any(String),
          html: expect.stringContaining('tok123'),
        }),
      );
    });

    it('includes the app URL in the verification link', async () => {
      await service.sendVerificationEmail('user@example.com', 'tok123');

      const { html } = mockEmail.send.mock.calls[0][0] as { html: string };
      expect(html).toContain('https://app.example.com');
    });
  });

  // ── sendPasswordReset ─────────────────────────────────────────────

  describe('sendPasswordReset', () => {
    it('sends email with password-reset template to the given address', async () => {
      await service.sendPasswordReset('user@example.com', 'reset-tok');

      expect(mockEmail.send).toHaveBeenCalledTimes(1);
      expect(mockEmail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.any(String),
          html: expect.stringContaining('reset-tok'),
        }),
      );
    });

    it('includes the app URL in the reset link', async () => {
      await service.sendPasswordReset('user@example.com', 'reset-tok');

      const { html } = mockEmail.send.mock.calls[0][0] as { html: string };
      expect(html).toContain('https://app.example.com');
    });
  });
});
