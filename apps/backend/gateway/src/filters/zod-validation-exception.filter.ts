import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

type ZodIssueLog = {
  path: string;
  code: string;
  message: string;
  expected?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  inclusive?: unknown;
  validation?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const formatPath = (path: unknown): string => {
  if (!Array.isArray(path)) return '';

  return path.map(String).join('.');
};

const sanitizeIssue = (issue: unknown): ZodIssueLog => {
  if (!isRecord(issue)) {
    return {
      path: '',
      code: 'unknown',
      message: 'Unknown validation issue',
    };
  }

  return {
    path: formatPath(issue['path']),
    code: typeof issue['code'] === 'string' ? issue['code'] : 'unknown',
    message: typeof issue['message'] === 'string' ? issue['message'] : 'Validation issue',
    expected: issue['expected'],
    minimum: issue['minimum'],
    maximum: issue['maximum'],
    inclusive: issue['inclusive'],
    validation: issue['validation'],
  };
};

const getIssues = (exception: ZodValidationException): ZodIssueLog[] => {
  const zodError = exception.getZodError();

  if (!isRecord(zodError) || !Array.isArray(zodError['issues'])) {
    return [];
  }

  return zodError['issues'].map(sanitizeIssue);
};

@Catch(ZodValidationException)
export class ZodValidationExceptionFilter implements ExceptionFilter<ZodValidationException> {
  private readonly logger = new Logger(ZodValidationExceptionFilter.name);

  catch(exception: ZodValidationException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const statusCode = exception.getStatus();
    const issues = getIssues(exception);

    this.logger.warn(
      {
        method: request.method,
        path: request.path,
        statusCode,
        issues,
      },
      'Zod validation failed',
    );

    response.status(statusCode).json(exception.getResponse());
  }
}
