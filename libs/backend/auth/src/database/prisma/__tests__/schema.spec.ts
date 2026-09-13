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

describe('auth prisma schema id and type contract', () => {
  it('contains no UUIDv4 defaults', () => {
    expect(schema).not.toContain('@default(uuid())');
  });

  it.each(['Credentials', 'OAuthAccount', 'Session'])('generates UUIDv7 for %s.id', (model) => {
    const line = fieldLine(modelBlock(model), 'id');
    expect(line).toContain('@db.Uuid');
    expect(line).toContain('@default(uuid(7))');
  });

  it.each([
    ['OAuthAccount', 'credentialsId'],
    ['Session', 'credentialsId'],
    ['Credentials', 'bannedBy'],
  ])('stores %s.%s as native UUID', (model, field) => {
    expect(fieldLine(modelBlock(model), field)).toContain('@db.Uuid');
  });

  it('keeps external provider ids as plain strings', () => {
    expect(fieldLine(modelBlock('OAuthAccount'), 'providerId')).toContain('String');
  });

  it('maps every model to a snake_case table', () => {
    for (const model of ['Credentials', 'OAuthAccount', 'Session']) {
      expect(modelBlock(model)).toMatch(/@@map\("[a-z_]+"\)/);
    }
  });

  it('stores every timestamp as TIMESTAMPTZ', () => {
    const lines = schema.split('\n').filter((line) => line.includes('DateTime'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toContain('@db.Timestamptz');
    }
  });
});
