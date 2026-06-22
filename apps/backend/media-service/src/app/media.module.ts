import { Module } from '@nestjs/common';
import { OrgMediaModule } from '@org/media';
import { HealthModule, LoggerModule, MetricsModule } from '@org/core';

@Module({
  imports: [OrgMediaModule, LoggerModule.forService('media-service'), HealthModule, MetricsModule],
  controllers: [],
})
export class MediaModule {}
