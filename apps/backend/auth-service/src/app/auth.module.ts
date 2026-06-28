import { Module } from '@nestjs/common';
import { OrgAuthModule } from '@org/auth';

@Module({
  imports: [OrgAuthModule],
  controllers: [],
})
export class AuthModule {}
