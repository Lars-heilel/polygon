import { Module } from '@nestjs/common';
import { OrgMediaModule } from '@org/media';

@Module({
  imports: [OrgMediaModule],
  controllers: [],
})
export class MediaModule {}
