import { Module } from '@nestjs/common';
import { ObservabilityModule, SERVICE_NAMES } from '@org/core';
import { OrgUserModule } from '@org/user';

@Module({
  imports: [ObservabilityModule.forService(SERVICE_NAMES.user), OrgUserModule],
  controllers: [],
})
export class UserModule {}
