import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

import { HTTP_HISTOGRAM_NAME } from '../metrics/metrics.module';

const IGNORED_PATHS = ['/health', '/metrics', '/api/metrics'];

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_HISTOGRAM_NAME)
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    if (IGNORED_PATHS.some((p) => req.url?.startsWith(p))) return next.handle();

    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.observe(req.method, req.url, res.statusCode, start),
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          this.observe(req.method, req.url, status, start);
        },
      }),
    );
  }

  private observe(method: string, url: string, statusCode: number, start: number): void {
    const duration = (Date.now() - start) / 1000;
    this.histogram.observe(
      {
        method,
        path: this.normalizePath(url),
        status_code: String(statusCode),
      },
      duration,
    );
  }

  private normalizePath(url: string): string {
    return url
      .split('?')[0]
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
