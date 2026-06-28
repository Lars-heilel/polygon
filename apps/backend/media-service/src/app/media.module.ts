import { Module } from '@nestjs/common';
import { OrgMediaModule } from '@org/media';
import { HealthModule } from '@org/core';

@Module({
  imports: [OrgMediaModule, HealthModule],
  controllers: [],
})
export class MediaModule {}
