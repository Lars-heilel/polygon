import { Module } from '@nestjs/common';
import { OrgUserModule } from '@org/user';

@Module({
  imports: [OrgUserModule],
  controllers: [],
})
export class UserModule {}
