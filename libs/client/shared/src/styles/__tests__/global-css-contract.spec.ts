import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function resolveCssBundle(entry: string, seen = new Set<string>()): string {
  const entryPath = join(currentDir, entry);
  if (seen.has(entryPath)) return '';
  seen.add(entryPath);
  const raw = readFileSync(entryPath, 'utf8');
  const dir = dirname(entryPath);
  return raw.replace(/@import\s+['"](\.\/[^'"]+\.css)['"]\s*;/g, (_match, rel: string) => {
    const resolved = join(dir, rel);
    if (seen.has(resolved)) return '';
    seen.add(resolved);
    return readFileSync(resolved, 'utf8');
  });
}

const css = resolveCssBundle('../global.css');

describe('global.css design-system contract', () => {
  it('defines the semantic tokens consumed by shared UI', () => {
    const requiredTokens = [
      '--color-background',
      '--color-surface',
      '--color-surface-elevated',
      '--color-surface-muted',
      '--color-border',
      '--color-border-strong',
      '--color-text',
      '--color-text-muted',
      '--color-text-inverse',
      '--color-primary',
      '--color-primary-hover',
      '--color-primary-muted',
      '--color-danger',
      '--color-danger-muted',
      '--color-success',
      '--color-success-muted',
      '--color-warning',
      '--color-warning-muted',
      '--color-info',
      '--color-info-muted',
      '--shadow-surface',
      '--shadow-popover',
      '--shadow-focus',
    ];

    for (const token of requiredTokens) {
      expect(css).toContain(token);
    }
  });

  it('does not style app components through broad utility-class selectors', () => {
    const forbiddenSelectors = [
      'aside {',
      '.bg-primary\\/10',
      'button.bg-primary',
      'a.bg-primary',
      '.bg-primary.rounded-2xl',
      '.bg-primary.rounded-lg',
      '.bg-green-500',
      '.border-b.border-border',
      '.border-t.border-border',
      "[role='dialog']",
      '.modal-content',
    ];

    for (const selector of forbiddenSelectors) {
      expect(css).not.toContain(selector);
    }
  });
});
