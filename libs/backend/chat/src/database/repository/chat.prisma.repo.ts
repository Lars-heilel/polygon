import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}
}
