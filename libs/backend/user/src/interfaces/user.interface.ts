import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';

import type { UpdateUserDto } from '../dto/update-user.dto';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  upsert(data: CreateUserEventInput): Promise<UserPublic>;
  update(id: string, data: UpdateUserInput): Promise<UserPublic>;
}

export interface IUserService {
  createFromEvent(data: CreateUserEventInput): Promise<UserPublic>;
  getById(id: string): Promise<User>;
  update(id: string, dto: UpdateUserInput): Promise<UserPublic>;
}

export interface IUserController {
  handleUserRegistered(data: CreateUserEventInput): Promise<UserPublic>;
  getById(payload: { id: string }): Promise<User>;
  update(payload: { id: string; dto: UpdateUserDto }): Promise<UserPublic>;
}
