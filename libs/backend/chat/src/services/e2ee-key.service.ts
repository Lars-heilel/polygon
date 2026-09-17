import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  DeviceRecord,
  PrekeyBundleRecord,
  PublishPrekeysInput,
  RegisterDeviceInput,
} from '@org/common';
import { publishPrekeysSchema, registerDeviceSchema } from '@org/common';
import { E2EE_KEY_REPOSITORY_TOKEN } from '@org/core';

import { InMemoryE2eeKeyRepository } from '../database/repository/e2ee-key.memory.repo';
import type { IE2eeKeyRepository, IE2eeKeyService } from '../interfaces/chat.interface';

/**
 * Device + prekey registry for E2EE (X3DH reachability material only —
 * the service never sees plaintext or private keys).
 *
 * Registration stores the device only. A device becomes reachable once it
 * publishes real key material via {@link publishPrekeys}; until then
 * {@link consumePrekeyBundle} returns `null` ("not enrolled yet").
 */
@Injectable()
export class E2eeKeyService implements IE2eeKeyService {
  private readonly logger = new Logger(E2eeKeyService.name);
  private readonly repo: IE2eeKeyRepository;

  constructor(
    @Optional()
    @Inject(E2EE_KEY_REPOSITORY_TOKEN)
    repo?: IE2eeKeyRepository,
  ) {
    this.repo = repo ?? new InMemoryE2eeKeyRepository();
  }

  async registerDevice(input: RegisterDeviceInput): Promise<DeviceRecord> {
    this.logger.log({
      eventType: 'device_register_requested',
      hasUserId: !!input.userId,
      hasDeviceId: !!input.deviceId,
      hasIdentityKey: !!input.identityKey,
      hasRegistrationId: input.registrationId !== undefined,
    });
    const parsed = registerDeviceSchema.parse(input);
    const record = await this.repo.upsertDevice(parsed);
    this.logger.log({
      eventType: 'device_register_done',
      hasUserId: !!parsed.userId,
      hasDeviceId: !!parsed.deviceId,
    });
    return record;
  }

  async revokeDevice(deviceId: string): Promise<{ revoked: boolean }> {
    this.logger.log({ eventType: 'device_revoke_requested', hasDeviceId: !!deviceId });
    await this.repo.deleteDevice(deviceId);
    this.logger.log({ eventType: 'device_revoke_done', hasDeviceId: !!deviceId });
    return { revoked: true };
  }

  async getDevice(deviceId: string): Promise<DeviceRecord | null> {
    this.logger.log({ eventType: 'device_get_requested', hasDeviceId: !!deviceId });
    const device = await this.repo.findDevice(deviceId);
    this.logger.log({
      eventType: 'device_get_done',
      hasDeviceId: !!deviceId,
      found: !!device,
    });
    return device;
  }

  async publishPrekeys(input: PublishPrekeysInput): Promise<{ published: number }> {
    this.logger.log({
      eventType: 'prekeys_publish_requested',
      hasDeviceId: !!input.deviceId,
      hasSignedPrekey: !!input.signedPrekey,
      hasSignature: !!input.signedPrekeySignature,
      prekeyCount: input.oneTimePrekeys.length,
    });
    const parsed = publishPrekeysSchema.parse(input);
    await this.repo.saveSignedPrekey(
      parsed.deviceId,
      parsed.signedPrekey,
      parsed.signedPrekeySignature,
    );
    await this.repo.addOneTimePrekeys(parsed.deviceId, parsed.oneTimePrekeys);
    this.logger.log({
      eventType: 'prekeys_publish_done',
      hasDeviceId: !!parsed.deviceId,
      prekeyCount: parsed.oneTimePrekeys.length,
    });
    return { published: parsed.oneTimePrekeys.length };
  }

  async consumePrekeyBundle(deviceId: string): Promise<PrekeyBundleRecord | null> {
    this.logger.log({ eventType: 'prekeys_consume_requested', hasDeviceId: !!deviceId });
    const device = await this.repo.findDevice(deviceId);
    if (!device) {
      this.logger.log({ eventType: 'prekeys_consume_done', hasDeviceId: !!deviceId, found: false });
      return null;
    }
    const signed = await this.repo.findSignedPrekey(deviceId);
    if (!signed) {
      this.logger.log({ eventType: 'prekeys_consume_done', hasDeviceId: !!deviceId, found: false });
      return null;
    }
    const oneTimePrekey = await this.repo.consumeOneTimePrekey(deviceId);
    const bundle: PrekeyBundleRecord = {
      deviceId: device.deviceId,
      identityKey: device.identityKey,
      signedPrekey: signed.signedPrekey,
      signedPrekeySignature: signed.signedPrekeySignature,
      oneTimePrekey,
    };
    this.logger.log({
      eventType: 'prekeys_consume_done',
      hasDeviceId: !!deviceId,
      found: true,
      hasOneTimePrekey: oneTimePrekey !== null,
    });
    return bundle;
  }
}
