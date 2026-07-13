export * from './lib/auth.module';
export * from './services/auth.service';
export * from './interfaces/auth.interface';
export * from './strategies/local.strategy';
export * from './strategies/github.strategy';
export * from './strategies/google.strategy';
export * from './guards/local.guard';
export * from './guards/github.guard';
export * from './guards/google.guard';
export * from './guards/session.guard';
export { PrismaService } from './database/prisma/prisma.service';
export { SessionRedisRepository } from './cache/session.redis.repo';

// DTOs
export * from './dto/index';
