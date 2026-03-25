import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AUTH_QUEUE } from '@org/core';
import { AuthModule } from './app/auth.module';

async function bootstrap() {
  const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } = process.env;
  const rabbitmqUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST ?? 'localhost'}:${RABBITMQ_PORT ?? 5672}`;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AuthModule, {
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: AUTH_QUEUE,
      queueOptions: { durable: true },
    },
  });

  await app.listen();
  Logger.log('Auth Service is listening on RabbitMQ queue: ' + AUTH_QUEUE);
}

bootstrap();
