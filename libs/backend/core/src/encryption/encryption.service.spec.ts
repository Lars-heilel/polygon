import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { EncryptionService } from './encryption.service';

jest.mock('bcrypt');

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get(EncryptionService);
  });

  describe('hash', () => {
    it('returns the hashed value from bcrypt', async () => {
      (mockBcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashed');

      const result = await service.hash('plaintext');

      expect(result).toBe('$2b$12$hashed');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('plaintext', 12);
    });
  });

  describe('compare', () => {
    it('returns true when value matches hash', async () => {
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.compare('plaintext', '$2b$12$hashed');

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith('plaintext', '$2b$12$hashed');
    });

    it('returns false when value does not match hash', async () => {
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.compare('wrong', '$2b$12$hashed');

      expect(result).toBe(false);
    });
  });
});
