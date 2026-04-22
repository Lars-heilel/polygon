import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

function isPrismaKnownError(e: unknown): e is { code: string; clientVersion: unknown } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    'clientVersion' in e &&
    typeof (e as { code: unknown }).code === 'string' &&
    (e as { code: string }).code.startsWith('P')
  );
}

export function handlePrismaError(error: unknown): never {
  if (!isPrismaKnownError(error)) {
    throw error;
  }

  const code = error.code;

  switch (code) {
    case 'P2002':
      throw new ConflictException('Resource already exists');
    case 'P2025':
      throw new NotFoundException('Resource not found');
    case 'P2003':
      throw new BadRequestException('Related resource not found');
    case 'P2014':
      throw new BadRequestException('Required relation violation');
    case 'P2000':
      throw new BadRequestException('Input value is too long');
    default:
      throw new InternalServerErrorException(`Database error [${code}]`);
  }
}
