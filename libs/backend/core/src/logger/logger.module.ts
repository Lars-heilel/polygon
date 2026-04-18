import { DynamicModule, Module } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'http';
import type pino from 'pino';

const LEVEL_LABELS: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

function buildTransport(
  serviceName: string,
): pino.TransportSingleOptions | pino.TransportMultiOptions {
  const lokiTarget: pino.TransportSingleOptions = {
    target: 'pino-loki',
    options: {
      host: process.env['LOKI_URL'] ?? 'http://localhost:3100',
      labels: { service: serviceName },
      propsToLabels: ['levelName'],
      batching: { interval: 5 },
    },
  };

  if (process.env['NODE_ENV'] !== 'production') {
    return {
      targets: [
        { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
        lokiTarget,
      ],
    };
  }

  return lokiTarget;
}

const IGNORED_PATHS = ['/health', '/metrics', '/api/metrics'];

@Module({})
export class LoggerModule {
  static forService(serviceName: string): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          forRoutes: [{ path: '/{*splat}', method: RequestMethod.ALL }],
          pinoHttp: {
            transport: buildTransport(serviceName),
            level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
            mixin: (_obj: object, level: number) => ({
              levelName: LEVEL_LABELS[level] ?? String(level),
            }),
            autoLogging: {
              ignore: (req: IncomingMessage) =>
                IGNORED_PATHS.some((p) => req.url?.startsWith(p)),
            },
            serializers: {
              req: (req) => ({ method: req.method, url: req.url }),
              res: (res) => ({ statusCode: res.statusCode }),
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            customProps: () => {
              const span = trace.getActiveSpan();
              if (!span?.isRecording()) return {};
              const ctx = span.spanContext();
              return { trace_id: ctx.traceId, span_id: ctx.spanId };
            },
          },
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
