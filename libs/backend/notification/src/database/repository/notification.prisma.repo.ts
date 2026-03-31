import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationPrismaRepository {
  constructor(private prisma: PrismaService) {}
}
