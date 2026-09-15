import { senderKeyDistributionSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class DistributeSenderKeyDto extends createZodDto(senderKeyDistributionSchema) {}
