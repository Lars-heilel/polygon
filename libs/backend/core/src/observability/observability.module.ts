import { Module, type DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';

import { HealthController } from './health.controller';
import { createLoggerOptions } from './logger';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { OBSERVABILITY_SERVICE_NAME } from './observability.constants';
import type { ObservabilityServiceName } from './observability.types';

@Module({})
export class ObservabilityModule {
  static forService(serviceName: ObservabilityServiceName): DynamicModule {
    return {
      module: ObservabilityModule,
      imports: [LoggerModule.forRoot(createLoggerOptions(serviceName)), TerminusModule],
      controllers: [HealthController, MetricsController],
      providers: [
        { provide: OBSERVABILITY_SERVICE_NAME, useValue: serviceName },
        MetricsService,
        { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
      ],
      exports: [MetricsService],
    };
  }
}
