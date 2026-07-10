import { Module } from '@nestjs/common';
import { OrgAuthModule } from '@org/auth';
import { ObservabilityModule, SERVICE_NAMES } from '@org/core';

@Module({
  imports: [ObservabilityModule.forService(SERVICE_NAMES.auth), OrgAuthModule],
  controllers: [],
})
export class AuthModule {}
