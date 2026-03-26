import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';

// Переиспользуемый модуль health-проверок.
// Импортируй в модуль каждого сервиса который хочет /health эндпоинт.
@Module({
  imports: [TerminusModule],
  providers: [PrismaHealthIndicator],
  exports: [TerminusModule, PrismaHealthIndicator],
})
export class HealthModule {}
