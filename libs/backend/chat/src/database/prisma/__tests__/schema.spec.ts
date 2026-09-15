import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = readFileSync(join(__dirname, '..', 'schema.prisma'), 'utf8');

function modelBlock(model: string): string {
  const blocks = schema.split(/^model /m);
  const found = blocks.find((block) => block.startsWith(`${model} `));
  if (!found) throw new Error(`model ${model} not found in schema.prisma`);
  return found;
}

function fieldLine(block: string, field: string): string {
  const line = block.split('\n').find((candidate) => candidate.trim().startsWith(`${field} `));
  if (!line) throw new Error(`field ${field} not found`);
  return line;
}

function dateTimeLines(): string[] {
  return schema.split('\n').filter((line) => line.includes('DateTime'));
}

describe('chat prisma schema id and type contract', () => {
  it('contains no UUIDv4 defaults', () => {
    expect(schema).not.toContain('@default(uuid())');
  });

  it('uses UUIDv7 for Chat.id', () => {
    const line = fieldLine(modelBlock('Chat'), 'id');
    expect(line).toContain('@db.Uuid');
    expect(line).toContain('@default(uuid(7))');
  });

  it('uses UUIDv7 for MessageAttachment.id', () => {
    const line = fieldLine(modelBlock('MessageAttachment'), 'id');
    expect(line).toContain('@db.Uuid');
    expect(line).toContain('@default(uuid(7))');
  });

  it('uses BIGINT identity for Message.id', () => {
    const line = fieldLine(modelBlock('Message'), 'id');
    expect(line).toContain('BigInt');
    expect(line).toContain('@default(autoincrement())');
  });

  it.each([
    ['Chat', 'lastMessageId'],
    ['ChatMember', 'lastReadMessageId'],
    ['MessageAttachment', 'messageId'],
    ['MessageDeletion', 'messageId'],
    ['MessageForwardContext', 'messageId'],
    ['MessageForwardContext', 'originalMessageId'],
  ])('stores %s.%s as BIGINT', (model, field) => {
    expect(fieldLine(modelBlock(model), field)).toContain('BigInt');
  });

  it.each([
    ['Chat', 'selfOwnerId'],
    ['Message', 'senderId'],
    ['Message', 'deletedById'],
    ['ChatMember', 'userId'],
    ['MessageForwardContext', 'originalChatId'],
    ['MessageForwardContext', 'originalAuthorId'],
  ])('stores %s.%s as native UUID', (model, field) => {
    expect(fieldLine(modelBlock(model), field)).toContain('@db.Uuid');
  });

  it('stores attachment fileSizeSnapshot as BIGINT', () => {
    expect(fieldLine(modelBlock('MessageAttachment'), 'fileSizeSnapshot')).toContain('BigInt');
  });

  it('keeps attachment category and message/chat types as TEXT (CHECK lives in migration)', () => {
    expect(fieldLine(modelBlock('MessageAttachment'), 'category')).toContain('String');
    expect(fieldLine(modelBlock('Message'), 'type')).toContain('String');
    expect(fieldLine(modelBlock('Chat'), 'type')).toContain('String');
    expect(schema).not.toContain('enum MessageType');
    expect(schema).not.toContain('enum ChatType');
    expect(schema).toContain('enum ChatRole');
  });

  it('tracks link presence as a boolean column', () => {
    const line = fieldLine(modelBlock('Message'), 'hasLink');
    expect(line).toContain('Boolean');
    expect(line).toContain('@default(false)');
  });

  it('identifies direct chats by a deterministic unique key', () => {
    expect(fieldLine(modelBlock('Chat'), 'directKey')).toContain('String?');
    expect(modelBlock('Chat')).toContain('@@unique([directKey])');
  });

  it('maps every model to a snake_case table', () => {
    for (const model of [
      'Chat',
      'ChatMember',
      'Message',
      'MessageAttachment',
      'MessageForwardContext',
      'MessageDeletion',
      'Device',
      'OneTimePrekey',
      'SignedPrekey',
      'SenderKeyShare',
    ]) {
      expect(modelBlock(model)).toMatch(/@@map\("[a-z_]+"\)/);
    }
  });

  it('stores every timestamp as TIMESTAMPTZ', () => {
    const lines = dateTimeLines();
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toContain('@db.Timestamptz');
    }
  });

  it('indexes the hot read paths as composites', () => {
    expect(modelBlock('Chat')).toMatch(/@@index\(\[lastMessageAt.*id.*\]\)/);
    expect(modelBlock('ChatMember')).toMatch(/@@index\(\[userId,\s*chatId\]\)/);
    expect(modelBlock('Message')).toMatch(/@@index\(\[chatId.*createdAt.*id.*\]\)/);
  });

  it('marks E2EE chats explicitly with a default-off flag', () => {
    const line = fieldLine(modelBlock('Chat'), 'e2eeEnabled');
    expect(line).toContain('Boolean');
    expect(line).toContain('@default(false)');
  });

  it('stores one signed prekey per device for upsert-on-publish', () => {
    const block = modelBlock('SignedPrekey');
    expect(fieldLine(block, 'deviceId')).toContain('@id');
    expect(fieldLine(block, 'signedPrekeySignature')).toContain('String');
  });

  it('identifies sender-key shares per chat, chain, and recipient device', () => {
    const block = modelBlock('SenderKeyShare');
    expect(block).toMatch(/@@id\(\[chatId,\s*chainKeyId,\s*recipientDeviceId\]\)/);
    expect(block).toMatch(/@@index\(\[chatId,\s*recipientDeviceId\]\)/);
    expect(fieldLine(block, 'revoked')).toContain('@default(false)');
  });
});
