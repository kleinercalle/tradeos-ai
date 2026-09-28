import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { checkConsistency, looksValidReport, normalizeInstrument, normalizeTf, validate } from './index.js';

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
        image_check: [],
        timeframes: {},
        synthesis: {},
        verdict: 'NO_TRADE',
      }),
      true,
    );
  });

  it('rejects bad verdicts, non-objects, and missing image_check', () => {
    assert.equal(looksValidReport(null), false);
    assert.equal(
      looksValidReport({ instrument: 'NQ', session: 'x', timeframes: {}, synthesis: {}, verdict: 'BUY' }),
      false,
    );
    assert.equal(
      looksValidReport({ instrument: 'NQ', session: 'x', timeframes: {}, synthesis: {}, verdict: 'NO_TRADE' }),
      false,
    );
  });
});

const check = (index: number, instrument_seen: string | null, timeframe_seen: string | null, legible = true) => ({
  index,
  instrument_seen,
  timeframe_seen,
  legible,
});

describe('checkConsistency', () => {
  const allNq = [
    check(0, 'NQ', 'D'),
    check(1, 'NQ', '1H'),
    check(2, 'NQ', '15M'),
    check(3, 'NQ', '1M'),
  ];

  it('accepts a fully consistent set', () => {
    const r = checkConsistency(allNq, 'NQ', 4);
    assert.equal(r.ok, true);
  });

  it('blocks mixed instruments (NQ + GC)', () => {
    const r = checkConsistency(
      [check(0, 'NQ', 'D'), check(1, 'GC', '1H'), check(2, 'NQ', '15M'), check(3, 'NQ', '1M')],
      'NQ',
      4,
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, 'instrument_mismatch');
      assert.match(r.error, /GC/);
    }
  });

  it('blocks when screenshots show a different instrument than requested', () => {
    const r = checkConsistency(
      [check(0, 'ES', 'D'), check(1, 'ES', '1H'), check(2, 'ES', '15M'), check(3, 'ES', '1M')],
      'NQ',
      4,
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'instrument_mismatch');
  });

  it('blocks a 15M slot showing a 5M chart', () => {
    const r = checkConsistency(
      [check(0, 'NQ', 'D'), check(1, 'NQ', '1H'), check(2, 'NQ', '5M'), check(3, 'NQ', '1M')],
      'NQ',
      4,
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, 'timeframe_mismatch');
      assert.match(r.error, /Image 3/);
      assert.match(r.error, /15M/);
    }
  });

  it('warns (not blocks) on illegible images', () => {
    const r = checkConsistency(
      [check(0, 'NQ', 'D'), check(1, null, null, false), check(2, 'NQ', '15M'), check(3, 'NQ', '1M')],
      'NQ',
      4,
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.warnings.length > 0);
  });

  it('warns (not blocks) when labels are unreadable but legible', () => {
    const r = checkConsistency(
      [check(0, null, null), check(1, null, null), check(2, null, null), check(3, null, null)],
      'NQ',
      4,
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.warnings.length >= 4);
  });

  it('normalizes common timeframe aliases', () => {
    assert.equal(normalizeTf('m15'), '15M');
    assert.equal(normalizeTf('D'), 'DAILY');
    assert.equal(normalizeTf('h1'), '1H');
    assert.equal(normalizeTf(null), null);
  });

  it('normalizes instrument symbols', () => {
    assert.equal(normalizeInstrument(' nq '), 'NQ');
    assert.equal(normalizeInstrument('NQ1!'), 'NQ1');
    assert.equal(normalizeInstrument(null), null);
  });
});
