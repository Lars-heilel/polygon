import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { handlePrismaError } from '../prisma-error.handler';

const prismaError = (code: string): unknown => ({
  code,
  clientVersion: '6.0.0',
  meta: {
    target: ['email'],
    cause: 'secret@example.com',
  },
});

const capture = (error: unknown): Error => {
  try {
    handlePrismaError(error);
  } catch (caught) {
    return caught as Error;
  }

  throw new Error('Expected handlePrismaError to throw');
};

describe('handlePrismaError', () => {
  it.each([
    ['P2002', ConflictException, 'Resource already exists'],
    ['P2025', NotFoundException, 'Resource not found'],
    ['P2003', BadRequestException, 'Related resource not found'],
    ['P2014', BadRequestException, 'Required relation violation'],
    ['P2000', BadRequestException, 'Input value is too long'],
  ] as const)('maps %s to a sanitized Nest exception', (code, ExceptionClass, message) => {
    const caught = capture(prismaError(code));

    expect(caught).toBeInstanceOf(ExceptionClass);
    expect(caught.message).toBe(message);
    expect(JSON.stringify((caught as ConflictException).getResponse())).not.toContain(
      'secret@example.com',
    );
  });

  it('keeps only the Prisma code for unknown known errors', () => {
    const caught = capture(prismaError('P2999'));

    expect(caught).toBeInstanceOf(InternalServerErrorException);
    expect(caught.message).toBe('Database error [P2999]');
    expect(JSON.stringify((caught as InternalServerErrorException).getResponse())).not.toContain(
      'secret@example.com',
    );
  });

  it('rethrows non-Prisma errors unchanged', () => {
    const original = new Error('db transport failed');

    expect(() => handlePrismaError(original)).toThrow(original);
  });
});
