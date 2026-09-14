export * from './lib/chat.module';
export * from './services/chat.service';
export * from './interfaces/chat.interface';
export { PrismaService } from './database/prisma/prisma.service';

// DTOs
export * from './dto/create-direct-chat.dto';
export * from './dto/send-message.dto';
export * from './dto/mark-chat-read.dto';
export * from './dto/edit-message.dto';
export * from './dto/delete-message.dto';
export * from './dto/device.dto';
export * from './services/e2ee-key.service';

// Pure cache key builders (no runtime dependencies) — shared with gateway read-through.
export * from './cache/chat-cache.keys';
