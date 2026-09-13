import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// User ids are never generated here: they arrive via user.registered events
// carrying the auth-service id (UUIDv7 after the auth migration). This spec
// guards that no local UUIDv4 default sneaks in and silently forks the id space.
const schema = readFileSync(join(__dirname, '..', 'schema.prisma'), 'utf8');

function modelBlock(model: string): string {
  const blocks = schema.split(/^model /m);
  const found = blocks.find((block) => block.startsWith(`${model} `));
  if (!found) throw new Error(`model ${model} not found in schema.prisma`);
  return found;
}

describe('user prisma schema id and type contract', () => {
  it('contains no UUIDv4 defaults', () => {
    expect(schema).not.toContain('@default(uuid())');
  });

  it('stores User.id as native UUID without a local default', () => {
    const line = modelBlock('User')
      .split('\n')
      .find((candidate) => candidate.trim().startsWith('id '));
    expect(line).toContain('@db.Uuid');
    expect(line).not.toContain('@default');
  });

  it('maps the model to a snake_case table', () => {
    expect(modelBlock('User')).toMatch(/@@map\("[a-z_]+"\)/);
  });

  it('stores every timestamp as TIMESTAMPTZ', () => {
    const lines = schema.split('\n').filter((line) => line.includes('DateTime'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toContain('@db.Timestamptz');
    }
  });
});
