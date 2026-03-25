import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, Observable } from 'rxjs';
import {
  CurrentUser,
  JwtGuard,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
  type JwtPayload,
} from '@org/core';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller('users')
@UseGuards(JwtGuard)
export class UserGatewayController {
  constructor(
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.send(
      this.userClient.send(USER_PATTERNS.GET_BY_ID, { id: user.sub }),
    );
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.send(
      this.userClient.send(USER_PATTERNS.GET_BY_ID, { id }),
    );
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    return this.send(
      this.userClient.send(USER_PATTERNS.UPDATE, { id: user.sub, dto }),
    );
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(
        error.message ?? 'Internal server error',
        error.statusCode ?? 500,
      );
    }
  }
}
