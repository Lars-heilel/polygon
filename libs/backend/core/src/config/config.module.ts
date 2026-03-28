import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';

function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  return result.data;
}

@Module({
  imports: [ConfigModule.forRoot({ validate })],
  exports: [ConfigModule],
})
export class CoreConfigModule {}
