import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CoreConfigModule } from '../config/config.module';
import { TokenService } from './token.service';

@Module({
  imports: [CoreConfigModule, JwtModule.register({})],
  providers: [TokenService],
  exports: [TokenService],
})
export class CoreTokenModule {}
