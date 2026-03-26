import { Module } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

// LoggerModule регистрируется один раз в корневом модуле каждого сервиса.
// В dev — читаемый цветной вывод через pino-pretty.
// В prod — чистый JSON, который легко парсить любой log-системой.
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      // path-to-regexp v8 (NestJS 11) требует именованный wildcard вместо bare *
      forRoutes: [{ path: '/{*splat}', method: RequestMethod.ALL }],
      pinoHttp: {
        // В dev включаем красивый вывод, в prod — JSON
        transport: process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,

        // Уровень логирования: в prod не засоряем debug-сообщениями
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',

        // Автоматически логировать каждый HTTP запрос/ответ
        autoLogging: true,

        // Что включать в каждую строку лога
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },

        // Убираем поля которые только шумят
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
