import { Injectable, Logger } from '@nestjs/common';
import { envSchema, type Env } from './env.schema';

@Injectable()
export class ConfigService {
  private readonly config: Env;
  private readonly logger = new Logger(ConfigService.name);

  constructor() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      this.logger.error('Invalid environment variables:');
      this.logger.error(result.error.flatten().fieldErrors);
      process.exit(1);
    }

    this.config = result.data;
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.NODE_ENV;
  }

  get authDatabaseUrl(): string {
    return this.config.AUTH_DATABASE_URL;
  }

  get userDatabaseUrl(): string {
    return this.config.USER_DATABASE_URL;
  }

  get jwtAccessSecret(): string {
    return this.config.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.config.JWT_REFRESH_SECRET;
  }

  get jwtAccessExpiresIn(): number {
    return this.config.JWT_ACCESS_TOKEN_EXPIRES;
  }

  get jwtRefreshExpiresIn(): number {
    return this.config.JWT_REFRESH_TOKEN_EXPIRES;
  }

  get rabbitmqUrl(): string {
    const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } =
      this.config;
    return `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`;
  }

  get redisHost(): string {
    return this.config.REDIS_HOST;
  }

  get redisPort(): number {
    return this.config.REDIS_PORT;
  }

  get redisPassword(): string | undefined {
    return this.config.REDIS_PASSWORD;
  }

  get gatewayPort(): number {
    return this.config.GATEWAY_PORT;
  }

  get authPort(): number {
    return this.config.AUTH_PORT;
  }

  get userPort(): number {
    return this.config.USER_PORT;
  }
}
