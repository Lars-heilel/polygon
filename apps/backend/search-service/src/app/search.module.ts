import { Module } from '@nestjs/common';
import { OrgSearchModule } from '@org/search';

@Module({
  imports: [OrgSearchModule],
  controllers: [],
})
export class SearchAppModule {}
