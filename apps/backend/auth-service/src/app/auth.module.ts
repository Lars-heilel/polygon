import { Module } from '@nestjs/common';
import { OrgAuthModule } from '@org/auth';
import { HealthModule } from '@org/core';

@Module({
  imports: [OrgAuthModule, HealthModule],
  controllers: [],
})
export class AuthModule {}
