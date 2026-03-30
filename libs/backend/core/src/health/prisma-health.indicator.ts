import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';

// Интерфейс для любого Prisma-клиента: у каждого сервиса свой
// сгенерированный клиент, но метод $queryRaw есть у всех
interface PrismaLike {
  $queryRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
}

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  // key — имя которое будет в JSON ответе /health, например "auth_db"
  async isHealthy(
    key: string,
    prisma: PrismaLike
  ): Promise<HealthIndicatorResult> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        `${key} check failed`,
        this.getStatus(key, false, { error: (error as Error).message })
      );
    }
  }
}
