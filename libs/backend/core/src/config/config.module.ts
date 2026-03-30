import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { envSchema } from './env.schema';

function resolveEnvFile(): string {
  const env = process.env['NODE_ENV'];
  if (env === 'test') return resolve(process.cwd(), '.env.test');
  if (env === 'production') return resolve(process.cwd(), '.env.production');
  return resolve(process.cwd(), '.env');
}

function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  return result.data;
}

@Module({
  imports: [ConfigModule.forRoot({ envFilePath: resolveEnvFile(), validate })],
  exports: [ConfigModule],
})
export class CoreConfigModule {}
