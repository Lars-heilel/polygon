import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter, LoggingInterceptor, USER_QUEUE } from '@org/core';
import { UserModule } from './app/user.module';

async function bootstrap() {
  const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } =
    process.env;
  const rabbitmqUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${
    RABBITMQ_HOST ?? 'localhost'
  }:${RABBITMQ_PORT ?? 5672}`;

  const app = await NestFactory.create(UserModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: USER_QUEUE,
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  await app.startAllMicroservices();

  const port = process.env['USER_PORT'] ?? 3001;
  await app.listen(port);

  app
    .get(Logger)
    .log(`User Service: RMQ queue=${USER_QUEUE}, HTTP port=${port}`);
}

bootstrap();
