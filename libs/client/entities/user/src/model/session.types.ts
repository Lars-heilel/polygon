export interface SessionInfo {
  id: string;
  device: string | null;
  os: string | null;
  browser: string | null;
  ip: string | null;
  country: string | null;
  isCurrent: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}
