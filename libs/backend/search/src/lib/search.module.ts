import { Module } from '@nestjs/common';
import { CoreRedisModule, CoreSearchModule } from '@org/core';

import { SearchController } from '../controllers/search.controller';
import { SearchService } from '../services/search.service';

@Module({
  imports: [CoreSearchModule, CoreRedisModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class OrgSearchModule {}
