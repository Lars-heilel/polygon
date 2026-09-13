jest.mock('@org/core', () => ({
  USER_PATTERNS: {
    CREATE: 'user.create',
    GET_BY_ID: 'user.getById',
    GET_MANY_BY_IDS: 'user.getManyByIds',
    GET_ALL_PUBLIC: 'user.getAllPublic',
    UPDATE: 'user.update',
  },
  USER_EVENTS: {
    REGISTERED: 'user.registered',
    UPDATED: 'user.updated',
    DELETED: 'user.deleted',
  },
  USER_SERVICE_TOKEN: Symbol('USER_SERVICE'),
}));

import type { IUserService } from '../../interfaces/user.interface';
import { UserController } from '../user.controller';

describe('UserController', () => {
  let userService: {
    createFromEvent: jest.Mock;
    getById: jest.Mock;
    getManyByIds: jest.Mock;
    getAllPublic: jest.Mock;
    update: jest.Mock;
  };
  let controller: UserController;

  beforeEach(() => {
    userService = {
      createFromEvent: jest.fn(),
      getById: jest.fn(),
      getManyByIds: jest.fn(),
      getAllPublic: jest.fn(),
      update: jest.fn(),
    };
    controller = new UserController(userService as unknown as IUserService);
  });

  it('creates on event and on CREATE pattern with the same call', async () => {
    const data = { id: 'user-1', email: 'a@example.com', name: 'alice' };
    await controller.handleUserRegistered(data);
    await controller.create(data);
    expect(userService.createFromEvent).toHaveBeenCalledTimes(2);
    expect(userService.createFromEvent).toHaveBeenNthCalledWith(1, data);
  });

  it('delegates reads and update', async () => {
    await controller.getById({ id: 'user-1' });
    expect(userService.getById).toHaveBeenCalledWith('user-1');
    await controller.getManyByIds({ ids: ['user-1'] });
    expect(userService.getManyByIds).toHaveBeenCalledWith(['user-1']);
    await controller.getAllPublic({});
    expect(userService.getAllPublic).toHaveBeenCalled();
    await controller.update({ id: 'user-1', dto: { displayName: 'New' } });
    expect(userService.update).toHaveBeenCalledWith('user-1', { displayName: 'New' });
  });
});
