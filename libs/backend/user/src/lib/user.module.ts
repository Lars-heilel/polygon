import { Module } from '@nestjs/common';
import { CoreConfigModule, USER_PRISMA_REPOSITORY_TOKEN, USER_SERVICE_TOKEN } from '@org/core';

import { UserController } from '../controllers/user.controller';
import { PrismaService } from '../database/prisma/prisma.service';
import { UserPrismaRepository } from '../database/repository/user.prisma.repo';
import { UserService } from '../services/user.service';

@Module({
  imports: [CoreConfigModule],
  controllers: [UserController],
  providers: [
    PrismaService,
    { provide: USER_PRISMA_REPOSITORY_TOKEN, useClass: UserPrismaRepository },
    { provide: USER_SERVICE_TOKEN, useClass: UserService },
  ],
  exports: [PrismaService],
})
export class OrgUserModule {}
