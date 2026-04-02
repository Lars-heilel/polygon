import { Module } from '@nestjs/common';
import { CoreSearchModule } from '@org/core';

import { SearchController } from '../controllers/search.controller';
import { SearchService } from '../services/search.service';

@Module({
  imports: [CoreSearchModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class OrgSearchModule {}
