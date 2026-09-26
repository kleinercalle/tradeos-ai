/**
 * Unit tests for the deterministic risk calculator.
 * Run with: npm test   (tsx --test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateRisk, FUTURES_SPECS, round2 } from './risk.js';

describe('round2', () => {
  it('kills float dust', () => {
    assert.equal(round2(0.1 + 0.2), 0.3);
    assert.equal(round2(12.345), 12.35);
    assert.equal(round2(12.344), 12.34);
  });
});

describe('calculateRisk', () => {
  it('sizes an ES trade: $10k, 1%, 5pt stop -> 0 contracts + warning', () => {
    const r = calculateRisk({
      accountBalance: 10000,
      riskPercent: 1,
      entryPrice: 6000,
      stopPrice: 5995,
      spec: FUTURES_SPECS.ES,
    });
    assert.equal(r.riskAmount, 100);
    assert.equal(r.stopPoints, 5);
    assert.equal(r.stopTicks, 20);
    assert.equal(r.lossPerContract, 250);
    assert.equal(r.contracts, 0);
    assert.ok(r.warnings.some((w) => w.includes('too small')));
  });

  it('sizes an MES trade to whole contracts: $10k, 1%, 2.5pt stop -> 8 micros', () => {
    const r = calculateRisk({
      accountBalance: 10000,
      riskPercent: 1,
      entryPrice: 6000,
      stopPrice: 5997.5,
      spec: FUTURES_SPECS.MES,
    });
    // 2.5 pts = 10 ticks x $1.25 = $12.50 risk/contract -> floor(100 / 12.5) = 8
    assert.equal(r.stopTicks, 10);
    assert.equal(r.lossPerContract, 12.5);
    assert.equal(r.contracts, 8);
    assert.equal(r.actualRisk, 100);
    assert.equal(r.actualRiskPercent, 1);
    assert.deepEqual(r.warnings, []);
  });

  it('floors fractional contracts (never rounds up risk)', () => {
    const r = calculateRisk({
      accountBalance: 5000,
      riskPercent: 1, // $50 risk
      entryPrice: 6000,
      stopPrice: 5998, // 2 pts = 8 ticks x $12.5 = $100/contract
      spec: FUTURES_SPECS.ES,
    });
    assert.equal(r.contracts, 0); // floor(50/100) = 0, not 1
    assert.ok(r.actualRisk <= r.riskAmount);
  });

  it('is direction-agnostic: long and short stops give the same size', () => {
    const base = {
      accountBalance: 8000,
      riskPercent: 2,
      spec: FUTURES_SPECS.NQ,
    };
    const long = calculateRisk({ ...base, entryPrice: 21000, stopPrice: 20990 });
    const short = calculateRisk({ ...base, entryPrice: 21000, stopPrice: 21010 });
    assert.equal(long.contracts, short.contracts);
    assert.equal(long.lossPerContract, short.lossPerContract);
  });

  it('flags a stop that is not on the tick grid', () => {
    const r = calculateRisk({
      accountBalance: 5000,
      riskPercent: 2,
      entryPrice: 6000,
      stopPrice: 5999.9, // 0.1 pts = 0.4 ticks on ES
      spec: FUTURES_SPECS.ES,
    });
    assert.ok(r.warnings.some((w) => w.includes('tick grid')));
  });

  it('rejects invalid input with warnings and zero contracts', () => {
    const r = calculateRisk({
      accountBalance: -5,
      riskPercent: 0,
      entryPrice: 100,
      stopPrice: 100,
      spec: FUTURES_SPECS.ES,
    });
    assert.equal(r.contracts, 0);
    assert.ok(r.warnings.length >= 3);
    assert.ok(r.warnings.some((w) => w.includes('balance')));
    assert.ok(r.warnings.some((w) => w.includes('Risk must be')));
    assert.ok(r.warnings.some((w) => w.includes('cannot equal entry')));
  });

  it('is deterministic: same input -> identical output', () => {
    const input = {
      accountBalance: 12345.67,
      riskPercent: 1.5,
      entryPrice: 6012.25,
      stopPrice: 6005.5,
      spec: FUTURES_SPECS.ES,
    };
    assert.deepEqual(calculateRisk(input), calculateRisk(input));
  });
});
