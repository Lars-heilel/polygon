export * from './lib/chat.module';
export * from './services/chat.service';
export * from './interfaces/chat.interface';
export { PrismaService } from './database/prisma/prisma.service';

// DTOs
export * from './dto/create-direct-chat.dto';
export * from './dto/send-message.dto';
