export function throttleTracker(req: { headers?: { cookie?: string }; ip?: string }): string {
  const ip = req.ip ?? 'unknown';
  const cookie = req.headers?.cookie ?? '';
  const token = cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('access_token='))
    ?.slice('access_token='.length);
  if (token) {
    try {
      const sub = (
        JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64').toString()) as {
          sub?: unknown;
        }
      ).sub;
      if (typeof sub === 'string' && sub.length > 0) return `user:${sub}:${ip}`;
    } catch {
      /* malformed — fall through to ip */
    }
  }
  return `ip:${ip}`;
}
