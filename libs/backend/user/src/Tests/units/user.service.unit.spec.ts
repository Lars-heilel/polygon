import { NotFoundException } from '@nestjs/common';
import { MockProxy, mock } from 'jest-mock-extended';

import { IUserRepository } from '../../interfaces/user.interface';
import { UserService } from '../../services/user.service';
import { mockUserReturn } from '../fixtures/user.fixtures';

describe('UserService (unit)', () => {
  let service: UserService;
  let repoMock: MockProxy<IUserRepository>;

  beforeEach(() => {
    repoMock = mock<IUserRepository>();

    service = new UserService(repoMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getById', () => {
    it('should return user when exists', async () => {
      repoMock.findById.mockResolvedValue(mockUserReturn);

      const result = await service.getById('123');

      expect(repoMock.findById).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockUserReturn);
    });

    it('should throw NotFoundException when user not found', async () => {
      repoMock.findById.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.getById('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('update', () => {
    it('should update and return user', async () => {
      const existingUser = mockUserReturn;
      const updatedUser = {
        ...existingUser,
        name: 'Updated',
        updatedAt: new Date(),
      };
      repoMock.findById.mockResolvedValue(existingUser);
      repoMock.update.mockResolvedValue(updatedUser);

      const result = await service.update('123', { displayName: 'Updated' });

      expect(repoMock.findById).toHaveBeenCalledWith('123');
      expect(repoMock.update).toHaveBeenCalledWith('123', { displayName: 'Updated' });
      expect(result).toEqual(updatedUser);
    });
  });
});
