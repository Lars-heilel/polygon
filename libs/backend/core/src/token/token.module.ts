import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { CoreConfigModule } from '../config/config.module';

@Module({
  imports: [
    CoreConfigModule,
    JwtModule.register({}),
  ],
  providers: [TokenService],
  exports: [TokenService],
})
export class CoreTokenModule {}
