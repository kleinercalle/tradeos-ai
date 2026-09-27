import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { looksValidReport, validate } from './index.js';

const img = (n = 100) => ({
  mimeType: 'image/jpeg',
  data: 'a'.repeat(n),
});

const good = {
  consent: true,
  instrument: 'nq',
  session: '2026-09-26 New York',
  images: [img(), img(), img(), img()],
};

describe('validate', () => {
  it('accepts a well-formed request', () => {
    const r = validate(good);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.instrument, 'NQ');
  });

  it('rejects missing consent', () => {
    const r = validate({ ...good, consent: false });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /consent/i);
  });

  it('rejects unknown instruments', () => {
    const r = validate({ ...good, instrument: 'DOGE' });
    assert.equal(r.ok, false);
  });

  it('rejects empty session', () => {
    const r = validate({ ...good, session: '  ' });
    assert.equal(r.ok, false);
  });

  it('rejects zero images', () => {
    const r = validate({ ...good, images: [] });
    assert.equal(r.ok, false);
  });

  it('rejects more than 4 images', () => {
    const r = validate({ ...good, images: [img(), img(), img(), img(), img()] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /Maximum 4/);
  });

  it('rejects oversized images', () => {
    const r = validate({ ...good, images: [{ mimeType: 'image/png', data: 'a'.repeat(7_000_001) }] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /5 MB/);
  });

  it('rejects bad mime types', () => {
    const r = validate({ ...good, images: [{ mimeType: 'image/gif', data: 'aaa' }] });
    assert.equal(r.ok, false);
  });
});

describe('looksValidReport', () => {
  it('accepts a minimal valid report', () => {
    assert.equal(
      looksValidReport({
        instrument: 'NQ',
        session: 'x',
        timeframes: {},
        synthesis: {},
        verdict: 'NO_TRADE',
      }),
      true,
    );
  });

  it('rejects bad verdicts and non-objects', () => {
    assert.equal(looksValidReport(null), false);
    assert.equal(
      looksValidReport({ instrument: 'NQ', session: 'x', timeframes: {}, synthesis: {}, verdict: 'BUY' }),
      false,
    );
  });
});
