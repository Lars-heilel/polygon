import { Inject, Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

import { OBSERVABILITY_SERVICE_NAME } from './observability.constants';

type HttpMetricLabels = 'service' | 'method' | 'route' | 'status_code';
type WebsocketMetricLabels = 'service';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly requestDuration: Histogram<HttpMetricLabels>;
  private readonly requestTotal: Counter<HttpMetricLabels>;
  private readonly websocketConnections: Gauge<WebsocketMetricLabels>;

  constructor(@Inject(OBSERVABILITY_SERVICE_NAME) private readonly serviceName: string) {
    this.registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({ register: this.registry });

    this.requestTotal = new Counter({
      name: 'polygon_http_requests_total',
      help: 'Total HTTP requests handled by Polygon services',
      labelNames: ['service', 'method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: 'polygon_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['service', 'method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.websocketConnections = new Gauge({
      name: 'polygon_websocket_connections',
      help: 'Current Gateway WebSocket connections',
      labelNames: ['service'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = {
      service: this.serviceName,
      method,
      route,
      status_code: String(statusCode),
    };

    this.requestTotal.inc(labels);
    this.requestDuration.observe(labels, durationSeconds);
  }

  setWebsocketConnections(count: number): void {
    this.websocketConnections.set({ service: this.serviceName }, count);
  }

  contentType(): string {
    return this.registry.contentType;
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
