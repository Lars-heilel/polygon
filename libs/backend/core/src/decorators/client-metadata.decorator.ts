import { ExecutionContext, Logger, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import * as geoip from 'geoip-lite';
import { parseUA } from 'ua-parser-modern';

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

  const parsedUA = parseUA(userAgent);
  const browser = `${parsedUA.browser.name || 'Unknown Browser'}${parsedUA.browser.version ? ` ${parsedUA.browser.version}` : ''}`;

  const chPlatform = req.headers['sec-ch-ua-platform'] as string | undefined;
  const chPlatformVersion = req.headers['sec-ch-ua-platform-version'] as string | undefined;
  const chModel = req.headers['sec-ch-ua-model'] as string | undefined;

  const osVersion = chPlatformVersion ? chPlatformVersion.replace(/"/g, '') : parsedUA.os.version || '';
  const osName = chPlatform ? chPlatform.replace(/"/g, '') : parsedUA.os.name || 'Unknown OS';
  const os = `${osName}${osVersion ? ` ${osVersion}` : ''}`;

  const deviceType = parsedUA.device.type ? parsedUA.device.type.toUpperCase() : 'DESKTOP';
  const device =
    deviceType === 'DESKTOP'
      ? 'Desktop'
      : chModel
        ? `${chModel.replace(/"/g, '')} (${deviceType})`
        : `${parsedUA.device.vendor || ''} ${parsedUA.device.model || ''} (${deviceType})`.trim();

  const metadata: ClientMetadata = {
    ip,
    country,
    os,
    browser,
    device,
    userAgent,
    loginTime: new Date().toISOString(),
  };

  logger.verbose(`Extracted client metadata:\n${JSON.stringify(metadata, null, 2)}`);

  return metadata;
}

export const GetClientMetadata = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ClientMetadata => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return extractClientMetadata(req);
  },
);
