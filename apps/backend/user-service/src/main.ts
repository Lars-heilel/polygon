import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { USER_QUEUE } from '@org/core';
import { UserModule } from './app/user.module';

async function bootstrap() {
  const { RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_HOST, RABBITMQ_PORT } = process.env;
  const rabbitmqUrl = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST ?? 'localhost'}:${RABBITMQ_PORT ?? 5672}`;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(UserModule, {
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: USER_QUEUE,
      queueOptions: { durable: true },
    },
  });

  await app.listen();
  Logger.log('User Service is listening on RabbitMQ queue: ' + USER_QUEUE);
}

bootstrap();
