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

// Маппинг Prisma P-кодов → HTTP статусы
// Полный список: https://www.prisma.io/docs/orm/reference/error-reference
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

// Вместо import из '@prisma/client/runtime/library' (недоступен вне Prisma-сервисов)
// используем duck-typing — проверяем наличие свойств характерных для Prisma ошибок.
// Это надёжнее: работает с любой версией Prisma и любым сгенерированным клиентом.
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
  logStack: boolean; // нужен ли stack trace в логе
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const resolved = this.resolveException(exception);
    const contextType = host.getType<'http' | 'rpc'>();

    if (contextType === 'http') {
      this.handleHttp(exception, resolved, host);
    } else {
      this.handleRpc(exception, resolved);
    }
  }

  // Единая точка маппинга: любой тип исключения → { status, message }
  // HTTP и RPC контексты используют этот метод — дублирования нет
  private resolveException(exception: unknown): ResolvedError {
    // 1. NestJS HttpException — уже правильный формат
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

    // 2. NestJS RpcException
    if (exception instanceof RpcException) {
      const error = exception.getError();
      const message = typeof error === 'string' ? error : (error as { message: string }).message;
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        logStack: true,
      };
    }

    // 3. Prisma — известные ошибки (P-коды)
    // Пример: P2002 = unique constraint (два одновременных запроса на регистрацию)
    if (isPrismaKnownError(exception)) {
      const mapped = PRISMA_CODE_MAP[exception.code];
      if (mapped) return { ...mapped, logStack: false };
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Database error [${exception.code}]`,
        logStack: true,
      };
    }

    // 4. Prisma — невалидный запрос (баг в коде, не в данных)
    if (isPrismaValidationError(exception)) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid database query',
        logStack: true,
      };
    }

    // 5. Prisma — не удалось подключиться к БД
    if (isPrismaInitError(exception)) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database unavailable',
        logStack: true,
      };
    }

    // 6. ZodError — ручной z.parse() в сервисах (не через ZodValidationPipe)
    // ZodValidationPipe из nestjs-zod сам конвертирует ZodError → BadRequestException
    // этот кейс для z.parse() вызванного напрямую в бизнес-логике
    if (exception instanceof ZodError) {
      const message = exception.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      return { status: HttpStatus.BAD_REQUEST, message, logStack: false };
    }

    // 7. Всё остальное — непредвиденная ошибка, всегда логируем стек
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
