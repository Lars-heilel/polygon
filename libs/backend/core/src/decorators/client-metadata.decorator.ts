import { ExecutionContext, Logger, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import * as geoip from 'geoip-lite';
import DeviceDetector from 'node-device-detector';
import type { DetectResult } from 'node-device-detector';
import type { JSONObject } from 'node-device-detector/client-hints';
import ClientHints from 'node-device-detector/client-hints';

export interface ClientMetadata {
  ip: string;
  country: string;
  os: string;
  browser: string;
  device: string;
  userAgent: string;
  loginTime: string;
}

const logger = new Logger('GetClientMetadata');

const detector = new DeviceDetector({
  deviceIndexes: true,
});
const clientHints = new ClientHints();

function formatDevice(result: DetectResult): string {
  const deviceType = result.device.type ? result.device.type.toUpperCase() : 'DESKTOP';

  if (deviceType === 'DESKTOP') {
    return 'Desktop';
  }

  const brand = result.device.brand || '';
  const model = result.device.model || '';
  const label = `${brand} ${model}`.trim() || 'Unknown';

  return `${label} (${deviceType})`;
}

export function extractClientMetadata(req: Request): ClientMetadata {
  const userAgent = req.headers['user-agent'] || '';
  const rawIp =
    (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
  const ip = rawIp.split(',')[0].trim();

  let country =
    (req.headers['cf-ipcountry'] as string) ||
    (req.headers['x-appengine-country'] as string) ||
    'Unknown Location';

  if (country === 'Unknown Location' && ip && ip !== '::1' && ip !== '127.0.0.1') {
    const geo = geoip.lookup(ip);
    if (geo) {
      const cityPrefix = geo.city ? `${geo.city}, ` : '';
      country = `${cityPrefix}${geo.country}`;
    }
  }

  const hints = clientHints.parse(req.headers as unknown as JSONObject, {});
  const result = detector.detect(userAgent, hints);

  const browserName = result.client.name || 'Unknown Browser';
  const browserVersion = result.client.version || '';
  const browser = `${browserName}${browserVersion ? ` ${browserVersion}` : ''}`;

  const osName = result.os.name || 'Unknown OS';
  const osVersion = result.os.version || '';
  const os = `${osName}${osVersion ? ` ${osVersion}` : ''}`;

  const device = formatDevice(result);

  const metadata: ClientMetadata = {
    ip,
    country,
    os,
    browser,
    device,
    userAgent,
    loginTime: new Date().toISOString(),
  };

  logger.verbose(
    {
      hasIp: !!metadata.ip,
      hasCountry: !!metadata.country,
      hasOs: !!metadata.os,
      hasBrowser: !!metadata.browser,
      hasDevice: !!metadata.device,
      hasUserAgent: !!metadata.userAgent,
      hasLoginTime: !!metadata.loginTime,
    },
    'Extracted client metadata',
  );

  return metadata;
}

export const GetClientMetadata = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ClientMetadata => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return extractClientMetadata(req);
  },
);
