import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

// Interceptor замеряет время выполнения каждого обработчика.
// Работает и для HTTP (Gateway) и для RPC (микросервисы).
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start       = Date.now();
    const contextType = context.getType<'http' | 'rpc'>();

    // Получаем описание вызова в зависимости от типа контекста
    const label = contextType === 'http'
      ? this.httpLabel(context)
      : this.rpcLabel(context);

    // next.handle() — это сам обработчик (метод контроллера)
    // tap() выполняется ПОСЛЕ того как обработчик завершился
    return next.handle().pipe(
      tap({
        next:  () => this.logger.debug(`${label} — ${Date.now() - start}ms`),
        error: () => this.logger.debug(`${label} — ${Date.now() - start}ms [FAILED]`),
      }),
    );
  }

  private httpLabel(context: ExecutionContext): string {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    return `${req.method} ${req.url}`;
  }

  private rpcLabel(context: ExecutionContext): string {
    const data = context.switchToRpc().getContext<{ pattern?: string }>();
    return `RPC ${data?.pattern ?? context.getHandler().name}`;
  }
}
