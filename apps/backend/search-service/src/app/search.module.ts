import { Module } from '@nestjs/common';
import { ObservabilityModule, SERVICE_NAMES } from '@org/core';
import { OrgSearchModule } from '@org/search';

@Module({
  imports: [ObservabilityModule.forService(SERVICE_NAMES.search), OrgSearchModule],
  controllers: [],
})
export class SearchAppModule {}
