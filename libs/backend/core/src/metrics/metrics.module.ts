import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

// Подключает эндпоинт GET /metrics на каждом сервисе.
// Prometheus будет дёргать его каждые 15 секунд и собирать данные.
// По умолчанию включены метрики самого Node.js процесса:
//   - nodejs_heap_size_used_bytes    (память)
//   - nodejs_eventloop_lag_seconds   (задержка event loop)
//   - process_cpu_seconds_total      (CPU)
//   - nodejs_active_handles_total    (открытые соединения)
@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
  ],
  exports: [PrometheusModule],
})
export class MetricsModule {}
