import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  AUTH_CLIENT_TOKEN,
  AUTH_QUEUE,
  ConfigService,
  CoreConfigModule,
  CoreTokenModule,
  JwtGuard,
  USER_CLIENT_TOKEN,
  USER_QUEUE,
} from '@org/core';
import { AuthGatewayController } from '../controllers/auth.controller';
import { UserGatewayController } from '../controllers/user.controller';

@Module({
  imports: [
    CoreConfigModule,
    CoreTokenModule,
    ClientsModule.registerAsync([
      {
        name: AUTH_CLIENT_TOKEN,
        imports: [CoreConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmqUrl],
            queue: AUTH_QUEUE,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: USER_CLIENT_TOKEN,
        imports: [CoreConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmqUrl],
            queue: USER_QUEUE,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [AuthGatewayController, UserGatewayController],
  providers: [JwtGuard],
})
export class GatewayModule {}
