import type { CreateUserEventInput, UpdateUserInput, User, UserPublic } from '@org/common';

import type { UpdateUserDto } from '../dto/update-user.dto';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findPublicById(id: string): Promise<UserPublic | null>;
  findAllPublic(): Promise<UserPublic[]>;
  upsert(data: CreateUserEventInput): Promise<void>;
  update(id: string, data: UpdateUserInput): Promise<User | null>;
  delete(id: string): Promise<void>;
}

export interface IUserService {
  createFromEvent(data: CreateUserEventInput): Promise<void>;
  getById(id: string): Promise<User>;
  getPublicById(id: string): Promise<UserPublic>;
  getAllPublic(): Promise<UserPublic[]>;
  update(id: string, dto: UpdateUserInput): Promise<User>;
}

export interface IUserController {
  handleUserRegistered(data: CreateUserEventInput): Promise<void>;
  getById(payload: { id: string }): Promise<User>;
  getPublicById(payload: { id: string }): Promise<UserPublic>;
  getAllPublic(): Promise<UserPublic[]>;
  update(payload: { id: string; dto: UpdateUserDto }): Promise<User>;
}
