import { Module } from '@nestjs/common';
import { HealthModule } from '@org/core';
import { OrgUserModule } from '@org/user';

@Module({
  imports: [OrgUserModule, HealthModule],
  controllers: [],
})
export class UserModule {}
