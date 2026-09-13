import { createZodDto } from 'nestjs-zod';

import { confirmUploadSchema } from '@org/common';

export class ConfirmUploadDto extends createZodDto(confirmUploadSchema) {}
