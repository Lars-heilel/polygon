import { Module } from '@nestjs/common';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';
import { OrgSearchModule } from '@org/search';

import { HealthController } from '../controllers/health.controller';

@Module({
  imports: [OrgSearchModule, LoggerModule, HealthModule, MetricsModule],
  controllers: [HealthController],
})
export class SearchAppModule {}
