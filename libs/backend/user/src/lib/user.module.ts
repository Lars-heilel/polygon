import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { UserPrismaRepository } from '../database/repository/user.prisma.repo';
import { UserService } from '../services/user.service';
import { UserController } from '../controllers/user.controller';

@Module({
  controllers: [UserController],
  providers: [PrismaService, UserPrismaRepository, UserService],
})
export class OrgUserModule {}
