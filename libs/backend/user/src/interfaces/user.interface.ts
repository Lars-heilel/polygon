import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';

import type { UpdateUserDto } from '../dto/update-user.dto';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  upsert(data: CreateUserEventInput): Promise<UserPublic>;
  update(id: string, data: UpdateUserInput): Promise<UserPublic>;
  getAllPublic(): Promise<UserPublic[]>;
}

export interface IUserService {
  createFromEvent(data: CreateUserEventInput): Promise<UserPublic>;
  getById(id: string): Promise<User>;
  update(id: string, dto: UpdateUserDto): Promise<UserPublic>;
  getAllPublic(): Promise<UserPublic[]>;
}

export interface IUserController {
  handleUserRegistered(data: CreateUserEventInput): void;
  getById(payload: { id: string }): Promise<User>;
  getAllPublic(payload: { skip?: number; take?: number }): Promise<UserPublic[]>;
  update(payload: { id: string; dto: UpdateUserDto }): Promise<UserPublic>;
}
