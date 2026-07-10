export type ObservabilityServiceName =
  | 'gateway'
  | 'auth-service'
  | 'user-service'
  | 'chat-service'
  | 'media-service'
  | 'notification-service'
  | 'search-service';

export interface StartTelemetryOptions {
  serviceName: ObservabilityServiceName;
}
