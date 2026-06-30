export interface SessionCacheData {
  credentialsId: string;
  device: string;
  expiresAt: string;
}

export interface ISessionCacheRepository {
  save(sessionId: string, data: SessionCacheData, ttlSec: number): Promise<void>;
  find(sessionId: string): Promise<SessionCacheData | null>;
  remove(sessionId: string): Promise<void>;
  addToUserSessions(userId: string, sessionId: string): Promise<void>;
  getUserSessionIds(userId: string): Promise<string[]>;
  removeFromUserSessions(userId: string, sessionId: string): Promise<void>;
  exists(sessionId: string): Promise<boolean>;
}
