import { Module } from '@nestjs/common';
import { CoreConfigModule, HealthModule, LoggerModule, MetricsModule } from '@org/core';

@Module({
  imports: [
    CoreConfigModule,
    LoggerModule.forService('media-service'),
    HealthModule,
    MetricsModule,
  ],
})
export class MediaModule {}
