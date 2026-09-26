import assert from 'node:assert';
import { describe, it } from 'node:test';

import { resolveColorScheme } from './color-scheme';

describe('resolveColorScheme', () => {
  it('falls back to light for null/undefined (never throws on Colors index)', () => {
    assert.strictEqual(resolveColorScheme(null), 'light');
    assert.strictEqual(resolveColorScheme(undefined), 'light');
  });

  it('maps unspecified to light', () => {
    assert.strictEqual(resolveColorScheme('unspecified'), 'light');
  });

  it('keeps explicit light/dark', () => {
    assert.strictEqual(resolveColorScheme('light'), 'light');
    assert.strictEqual(resolveColorScheme('dark'), 'dark');
  });

  it('always returns a valid Colors key', () => {
    for (const input of [null, undefined, 'unspecified', 'light', 'dark', 'weird'] as const) {
      const key = resolveColorScheme(input);
      assert.ok(key === 'light' || key === 'dark', `bad key for ${String(input)}`);
    }
  });
});
