import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async cum() {
    return this.prisma;
  }
}
