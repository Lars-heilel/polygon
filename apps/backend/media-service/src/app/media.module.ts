import { Module } from '@nestjs/common';
import { ObservabilityModule, SERVICE_NAMES } from '@org/core';
import { OrgMediaModule } from '@org/media';

@Module({
  imports: [ObservabilityModule.forService(SERVICE_NAMES.media), OrgMediaModule],
  controllers: [],
})
export class MediaModule {}
