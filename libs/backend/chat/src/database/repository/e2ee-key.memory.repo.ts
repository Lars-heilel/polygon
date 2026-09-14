import { Injectable } from '@nestjs/common';
import type { DeviceRecord, RegisterDeviceInput } from '@org/common';

import type { IE2eeKeyRepository, SignedPrekeyPair } from '../../interfaces/chat.interface';

/**
 * Process-local E2EE key registry. Used in unit tests (no live DB) and as
 * the fallback when no Prisma-backed repository is injected.
 */
@Injectable()
export class InMemoryE2eeKeyRepository implements IE2eeKeyRepository {
  private readonly devices = new Map<string, DeviceRecord>();
  private readonly signedPrekeys = new Map<string, SignedPrekeyPair>();
  private readonly oneTimePrekeys = new Map<string, string[]>();

  async upsertDevice(input: RegisterDeviceInput): Promise<DeviceRecord> {
    const record: DeviceRecord = { ...input };
    this.devices.set(input.deviceId, record);
    return record;
  }

  async findDevice(deviceId: string): Promise<DeviceRecord | null> {
    return this.devices.get(deviceId) ?? null;
  }

  async deleteDevice(deviceId: string): Promise<void> {
    this.devices.delete(deviceId);
    this.signedPrekeys.delete(deviceId);
    this.oneTimePrekeys.delete(deviceId);
  }

  async saveSignedPrekey(
    deviceId: string,
    signedPrekey: string,
    signedPrekeySignature: string,
  ): Promise<void> {
    this.signedPrekeys.set(deviceId, { signedPrekey, signedPrekeySignature });
  }

  async findSignedPrekey(deviceId: string): Promise<SignedPrekeyPair | null> {
    return this.signedPrekeys.get(deviceId) ?? null;
  }

  async addOneTimePrekeys(deviceId: string, prekeys: string[]): Promise<void> {
    const existing = this.oneTimePrekeys.get(deviceId) ?? [];
    existing.push(...prekeys);
    this.oneTimePrekeys.set(deviceId, existing);
  }

  async consumeOneTimePrekey(deviceId: string): Promise<string | null> {
    const existing = this.oneTimePrekeys.get(deviceId) ?? [];
    const next = existing.shift();
    this.oneTimePrekeys.set(deviceId, existing);
    return next ?? null;
  }
}
