import { Module } from '@nestjs/common';
import { CoreConfigModule } from '../config/config.module';
import { NodemailerEmailProvider } from './nodemailer.provider';
import { EMAIL_PROVIDER } from './email.token';

@Module({
  imports: [CoreConfigModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useClass: NodemailerEmailProvider,
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class CoreEmailModule {}
