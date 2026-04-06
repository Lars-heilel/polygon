import { Module } from '@nestjs/common';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';
import { OrgSearchModule } from '@org/search';

@Module({
  imports: [OrgSearchModule, LoggerModule, HealthModule, MetricsModule],
  controllers: [],
})
export class SearchAppModule {}
