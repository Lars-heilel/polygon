import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

import type { StartTelemetryOptions } from './observability.types';

let sdk: NodeSDK | null = null;

export function startTelemetry(options: StartTelemetryOptions): void {
  if (process.env['NODE_ENV'] === 'test' || process.env['OTEL_ENABLED'] !== 'true') {
    return;
  }

  if (sdk) {
    return;
  }

  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: process.env['OTEL_SERVICE_VERSION'] ?? '0.0.1',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
        process.env['DEPLOYMENT_ENVIRONMENT'] ?? process.env['NODE_ENV'] ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    void sdk?.shutdown().finally(() => process.exit(0));
  });
}
