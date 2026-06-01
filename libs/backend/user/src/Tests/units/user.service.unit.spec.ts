import { NotFoundException } from '@nestjs/common';
import { MockProxy, mock } from 'jest-mock-extended';

import { IUserRepository } from '../../interfaces/user.interface';
import { UserService } from '../../services/user.service';
import { mockUserInput, mockUserReturn } from '../fixtures/user.fixtures';

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
    it('should call repo.update and return result', async () => {
      const updatedUser = { ...mockUserReturn, displayName: 'Updated' };
      repoMock.update.mockResolvedValue(updatedUser);

      const result = await service.update('123', { displayName: 'Updated' });

      expect(repoMock.update).toHaveBeenCalledWith('123', { displayName: 'Updated' });
      expect(result).toEqual(updatedUser);
    });

    it('should propagate NotFoundException from repository', async () => {
      repoMock.update.mockRejectedValue(new NotFoundException('User not found'));

      await expect(service.update('nonexistent', { displayName: 'Ghost' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createFromEvent', () => {
    it('should call repo.upsert with event data', async () => {
      const publicUser = {
        id: mockUserInput.id,
        name: mockUserInput.name,
        displayName: null,
        avatarUrl: null,
        bio: null,
      };
      repoMock.upsert.mockResolvedValue(publicUser);

      const result = await service.createFromEvent(mockUserInput);

      expect(repoMock.upsert).toHaveBeenCalledWith(mockUserInput);
      expect(result).toEqual(publicUser);
    });
  });
});
