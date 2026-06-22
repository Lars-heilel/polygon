import { Module } from '@nestjs/common';

import { CoreConfigModule } from '../config/config.module';

@Module({
  imports: [CoreConfigModule],
  exports: [],
})
export class CoreStorageModule {}
