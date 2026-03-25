import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { USER_EVENTS, USER_PATTERNS } from '@org/core';
import { UserService } from '../services/user.service';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @EventPattern(USER_EVENTS.REGISTERED)
  handleUserRegistered(@Payload() data: { id: string; email: string; name: string }) {
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
