export interface BanCacheMarker {
  reason: string;
  bannedUntil: string | null;
}

export interface IBanCacheRepository {
  get(credentialsId: string): Promise<BanCacheMarker | null>;
  set(credentialsId: string, marker: BanCacheMarker): Promise<void>;
  clear(credentialsId: string): Promise<void>;
  acquireLock(credentialsId: string, leaseMs: number): Promise<string | null>;
  renewAdminLock(credentialsId: string, ownershipToken: string, leaseMs: number): Promise<boolean>;
  releaseLock(credentialsId: string, ownershipToken: string): Promise<boolean>;
}
