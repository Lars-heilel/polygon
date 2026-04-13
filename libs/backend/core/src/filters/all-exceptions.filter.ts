import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

const PRISMA_CODE_MAP: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'Resource already exists' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Resource not found' },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Related resource not found',
  },
  P2014: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Required relation violation',
  },
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'Input value is too long' },
};

function isPrismaKnownError(e: unknown): e is { code: string; meta?: Record<string, unknown> } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    'clientVersion' in e &&
    typeof (e as { code: unknown }).code === 'string' &&
    (e as { code: string }).code.startsWith('P')
  );
}

function isPrismaValidationError(e: unknown): boolean {
  return (e as Error)?.constructor?.name === 'PrismaClientValidationError';
}

function isPrismaInitError(e: unknown): boolean {
  return (e as Error)?.constructor?.name === 'PrismaClientInitializationError';
}

interface ResolvedError {
  status: number;
  message: string;
  errors?: unknown;
  logStack: boolean;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const resolved = this.resolveException(exception);
    const contextType = host.getType<'http' | 'rpc' | 'ws'>();

    if (contextType === 'http') {
      this.handleHttp(exception, resolved, host);
    } else if (contextType === 'ws') {
      this.logger.error({
        message: resolved.message,
        status: resolved.status,
        stack: resolved.logStack && exception instanceof Error ? exception.stack : undefined,
      });
    } else {
      this.handleRpc(exception, resolved);
    }
  }

  private resolveException(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const body =
        typeof response === 'string'
          ? { message: response }
          : (response as Record<string, unknown>);
      const raw = body['message'] as string | string[];
      const message = Array.isArray(raw) ? raw.join(', ') : raw;
      const errors = body['errors'];
      return {
        status: exception.getStatus(),
        message,
        errors,
        logStack: false,
      };
    }

    if (exception instanceof RpcException) {
      const error = exception.getError();
      if (typeof error === 'object' && error !== null) {
        const payload = error as { statusCode?: number; message?: string };
        const status = payload.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
        const message = payload.message ?? 'Internal server error';
        return { status, message, logStack: status >= 500 };
      }

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: typeof error === 'string' ? error : 'Internal server error',
        logStack: true,
      };
    }

    if (isPrismaKnownError(exception)) {
      const mapped = PRISMA_CODE_MAP[exception.code];
      if (mapped) return { ...mapped, logStack: false };

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Database error [${exception.code}]`,
        logStack: true,
      };
    }

    if (isPrismaValidationError(exception)) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid database query',
        logStack: true,
      };
    }

    if (isPrismaInitError(exception)) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database unavailable',
        logStack: true,
      };
    }

    if (exception instanceof ZodError) {
      const message = exception.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      return { status: HttpStatus.BAD_REQUEST, message, logStack: false };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception instanceof Error ? exception.message : 'Internal server error',
      logStack: true,
    };
  }

  private handleHttp(exception: unknown, resolved: ResolvedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const logPayload = {
      method: request.method,
      url: request.url,
      status: resolved.status,
      message: resolved.message,
      stack: resolved.logStack && exception instanceof Error ? exception.stack : undefined,
    };

    if (resolved.status >= 500) {
      this.logger.error(logPayload);
    } else {
      this.logger.warn(logPayload);
    }

    response.status(resolved.status).json({
      statusCode: resolved.status,
      message: resolved.message,
      ...(resolved.errors !== undefined && { errors: resolved.errors }),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private handleRpc(exception: unknown, resolved: ResolvedError): void {
    this.logger.error({
      message: resolved.message,
      status: resolved.status,
      stack: resolved.logStack && exception instanceof Error ? exception.stack : undefined,
    });

    throw new RpcException({
      message: resolved.message,
      statusCode: resolved.status,
    });
  }
}
