import { publishPrekeysSchema, registerDeviceSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class RegisterDeviceDto extends createZodDto(registerDeviceSchema) {}
export class PublishPrekeysDto extends createZodDto(publishPrekeysSchema) {}
