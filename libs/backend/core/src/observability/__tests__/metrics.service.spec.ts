import { OBSERVABILITY_SERVICE_NAME } from '../observability.constants';
import { MetricsService } from '../metrics.service';

describe('MetricsService', () => {
  it('records HTTP request totals and duration buckets in Prometheus format', async () => {
    const service = new MetricsService('gateway');

    service.recordHttpRequest('GET', '/api/users/:id', 200, 0.123);

    const metrics = await service.metrics();

    expect(service.contentType()).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(metrics).toContain('polygon_http_requests_total');
    expect(metrics).toContain(
      'polygon_http_requests_total{service="gateway",method="GET",route="/api/users/:id",status_code="200"} 1',
    );
    expect(metrics).toContain('polygon_http_request_duration_seconds_bucket');
    expect(metrics).toContain(
      'polygon_http_request_duration_seconds_count{service="gateway",method="GET",route="/api/users/:id",status_code="200"} 1',
    );
  });

  it('records the current websocket connection count', async () => {
    const service = new MetricsService('gateway');

    service.setWebsocketConnections(7);

    await expect(service.metrics()).resolves.toContain(
      'polygon_websocket_connections{service="gateway"} 7',
    );
  });

  it('uses the observability service-name provider token', () => {
    expect(OBSERVABILITY_SERVICE_NAME).toBe('OBSERVABILITY_SERVICE_NAME');
  });
});
