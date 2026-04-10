import { Controller, Inject } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import type { CreateUserEventInput } from '@org/common';
import { USER_EVENTS, USER_PATTERNS, USER_SERVICE_TOKEN } from '@org/core';

import { UpdateUserDto } from '../dto/update-user.dto';
import type { IUserController, IUserService } from '../interfaces/user.interface';

@Controller()
export class UserController implements IUserController {
  constructor(@Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService) {}

  @EventPattern(USER_EVENTS.REGISTERED)
  handleUserRegistered(@Payload() data: CreateUserEventInput) {
    return this.userService.createFromEvent(data);
  }

  @MessagePattern(USER_PATTERNS.GET_BY_ID)
  getById(@Payload() payload: { id: string }) {
    return this.userService.getById(payload.id);
  }

  @MessagePattern(USER_PATTERNS.UPDATE)
  update(@Payload() payload: { id: string; dto: UpdateUserDto }) {
    return this.userService.update(payload.id, payload.dto);
  }
}
