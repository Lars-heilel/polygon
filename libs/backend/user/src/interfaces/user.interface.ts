import type {
  User,
  UserPublic,
  UpdateUserInput,
  CreateUserEventInput,
} from '@org/common';
import type { UpdateUserDto } from '../dto/update-user.dto';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findPublicById(id: string): Promise<UserPublic | null>;
  searchByName(query: string): Promise<UserPublic[]>;
  create(data: CreateUserEventInput): Promise<void>;
  update(id: string, data: UpdateUserInput): Promise<User>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export interface IUserService {
  createFromEvent(data: CreateUserEventInput): Promise<void>;
  getById(id: string): Promise<User>;
  getPublicById(id: string): Promise<UserPublic>;
  update(id: string, dto: UpdateUserInput): Promise<User>;
}

export interface IUserController {
  handleUserRegistered(data: CreateUserEventInput): Promise<void>;
  getById(payload: { id: string }): Promise<User>;
  update(payload: { id: string; dto: UpdateUserDto }): Promise<User>;
}
