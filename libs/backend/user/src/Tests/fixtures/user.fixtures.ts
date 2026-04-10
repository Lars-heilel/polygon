import type { CreateUserEventInput, User } from '@org/common';

export const mockUserInput: CreateUserEventInput = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'alice@test.com',
  name: 'Alice',
};

export const mockUserInput2: CreateUserEventInput = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'bob@test.com',
  name: 'Bob',
};
export const mockUserReturn: User = {
  id: '123',
  email: 'test@test.com',
  name: 'Test',
  displayName: null,
  avatarUrl: null,
  bio: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
