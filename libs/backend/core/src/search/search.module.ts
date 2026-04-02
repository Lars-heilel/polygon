import { Module } from '@nestjs/common';

import { CoreConfigModule } from '../config/config.module';
import { MeilisearchProvider } from './meilisearch.provider';
import { SEARCH_PROVIDER_TOKEN } from './search-provider.token';

@Module({
  imports: [CoreConfigModule],
  providers: [
    {
      provide: SEARCH_PROVIDER_TOKEN,
      useClass: MeilisearchProvider,
    },
  ],
  exports: [SEARCH_PROVIDER_TOKEN],
})
export class CoreSearchModule {}
