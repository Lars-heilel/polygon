import { rotateSenderKeySchema, senderKeyDistributionSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class DistributeSenderKeyDto extends createZodDto(senderKeyDistributionSchema) {}

export class RotateSenderKeyDto extends createZodDto(
  rotateSenderKeySchema.omit({ chatId: true }),
) {}
