import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable()
export class RpcErrorInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) => {
        if (err instanceof RpcException) {
          return throwError(() => err);
        }

        if (err instanceof HttpException) {
          const response = err.getResponse();
          const raw =
            typeof response === 'string'
              ? response
              : ((response as Record<string, unknown>)['message'] as string | string[]);
          const message = Array.isArray(raw) ? raw.join(', ') : raw;
          return throwError(
            () =>
              new RpcException({
                statusCode: err.getStatus(),
                message,
              }),
          );
        }
        const message = err instanceof Error ? err.message : 'Internal server error';
        return throwError(
          () =>
            new RpcException({
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message,
            }),
        );
      }),
    );
  }
}
