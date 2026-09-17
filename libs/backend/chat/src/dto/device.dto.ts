import { publishPrekeysSchema, registerDeviceSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

// userId comes from the JWT (@CurrentUser), never from the request body.
export class RegisterDeviceDto extends createZodDto(
  registerDeviceSchema.omit({ userId: true }),
) {}
export class PublishPrekeysDto extends createZodDto(publishPrekeysSchema) {}
