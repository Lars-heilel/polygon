import { Module } from '@nestjs/common';
import { OrgUserModule } from '@org/user';

@Module({
  imports: [OrgUserModule],
})
export class UserModule {}
