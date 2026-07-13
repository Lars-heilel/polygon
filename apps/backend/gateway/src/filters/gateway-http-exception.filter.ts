import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'http';
import { ZodValidationException } from 'nestjs-zod';

import { ZodValidationExceptionFilter } from './zod-validation-exception.filter';

type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
};

const getReasonPhrase = (statusCode: number): string =>
  STATUS_CODES[statusCode] ?? 'Error';

const getExceptionMessage = (exception: HttpException): string => {
  const response = exception.getResponse();

  if (typeof response === 'string') return response;

  if (typeof response === 'object' && response !== null && 'message' in response) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return 'Validation failed';
  }

  return exception.message || getReasonPhrase(exception.getStatus());
};

const getPublicMessage = (exception: HttpException): string => {
  const statusCode = exception.getStatus();

  if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return statusCode === HttpStatus.SERVICE_UNAVAILABLE
      ? 'Service temporarily unavailable'
      : 'Internal server error';
  }

  return getExceptionMessage(exception);
};

@Catch(HttpException)
export class GatewayHttpExceptionFilter implements ExceptionFilter<HttpException> {
  private readonly logger = new Logger(GatewayHttpExceptionFilter.name);
  private readonly zodFilter = new ZodValidationExceptionFilter();

  catch(exception: HttpException, host: ArgumentsHost): void {
    if (exception instanceof ZodValidationException) {
      this.zodFilter.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const statusCode = exception.getStatus();
    const body: ErrorResponse = {
      statusCode,
      error: getReasonPhrase(statusCode),
      message: getPublicMessage(exception),
      path: request.path,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(
      {
        method: request.method,
        path: request.path,
        statusCode,
      },
      'HTTP exception handled',
    );

    response.status(statusCode).json(body);
  }
}
