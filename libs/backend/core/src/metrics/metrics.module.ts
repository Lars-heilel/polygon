import { Module } from '@nestjs/common';
import { getToken, makeHistogramProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';

export const HTTP_HISTOGRAM_NAME = 'http_request_duration_seconds';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
  ],
  providers: [
    makeHistogramProvider({
      name: HTTP_HISTOGRAM_NAME,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),
  ],
  exports: [PrometheusModule, getToken(HTTP_HISTOGRAM_NAME)],
})
export class MetricsModule {}
