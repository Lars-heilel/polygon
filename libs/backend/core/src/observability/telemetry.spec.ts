import { NodeSDK } from '@opentelemetry/sdk-node';

import { startTelemetry } from './telemetry';

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    shutdown: jest.fn(),
    start: jest.fn(),
  })),
}));

const ORIGINAL_ENV = process.env;

describe('startTelemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('does not start telemetry when OpenTelemetry is disabled', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['OTEL_ENABLED'] = 'false';

    startTelemetry({ serviceName: 'gateway' });

    expect(NodeSDK).not.toHaveBeenCalled();
  });

  it('does not start telemetry while running tests even if enabled', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['OTEL_ENABLED'] = 'true';

    startTelemetry({ serviceName: 'gateway' });

    expect(NodeSDK).not.toHaveBeenCalled();
  });
});
