import { Module } from '@nestjs/common';
import { HealthModule } from '@org/core';
import { OrgSearchModule } from '@org/search';

@Module({
  imports: [
    OrgSearchModule,
    HealthModule,
  ],
  controllers: [],
})
export class SearchAppModule {}
