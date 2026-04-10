export * from './lib/auth.module';
export * from './services/auth.service';
export * from './interfaces/auth.interface';
export * from './strategies/local.strategy';
export * from './strategies/github.strategy';
export * from './strategies/yandex.strategy';
export * from './strategies/google.strategy';
export * from './guards/local.guard';
export * from './guards/github.guard';
export * from './guards/yandex.guard';
export * from './guards/google.guard';
export { PrismaService } from './database/prisma/prisma.service';

// DTOs
export * from './dto/login.dto';
export * from './dto/register.dto';
export * from './dto/resend-verification.dto';
export * from './dto/reset-password.dto';
