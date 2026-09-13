import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = readFileSync(join(__dirname, '..', 'schema.prisma'), 'utf8');

function modelBlock(model: string): string {
  const blocks = schema.split(/^model /m);
  const found = blocks.find((block) => block.startsWith(`${model} `));
  if (!found) throw new Error(`model ${model} not found in schema.prisma`);
  return found;
}

describe('notification prisma schema id and type contract', () => {
  it('contains no UUIDv4 defaults', () => {
    expect(schema).not.toContain('@default(uuid())');
  });

  it('generates UUIDv7 for PushSubscription.id', () => {
    const line = modelBlock('PushSubscription')
      .split('\n')
      .find((candidate) => candidate.trim().startsWith('id '));
    expect(line).toContain('@db.Uuid');
    expect(line).toContain('@default(uuid(7))');
  });

  it('stores userId as native UUID', () => {
    const line = modelBlock('PushSubscription')
      .split('\n')
      .find((candidate) => candidate.trim().startsWith('userId '));
    expect(line).toContain('@db.Uuid');
  });

  it('maps the model to a snake_case table', () => {
    expect(modelBlock('PushSubscription')).toMatch(/@@map\("[a-z_]+"\)/);
  });

  it('stores every timestamp as TIMESTAMPTZ', () => {
    const lines = schema.split('\n').filter((line) => line.includes('DateTime'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toContain('@db.Timestamptz');
    }
  });
});
