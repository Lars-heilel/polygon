import { DynamicModule, Module } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type pino from 'pino';

function buildTransport(
  serviceName: string,
): pino.TransportSingleOptions | pino.TransportMultiOptions {
  const lokiTarget: pino.TransportSingleOptions = {
    target: 'pino-loki',
    options: {
      host: process.env['LOKI_URL'] ?? 'http://localhost:3100',
      labels: { service: serviceName },
      propsToLabels: ['level'],
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
            autoLogging: true,
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
