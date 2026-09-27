/**
 * Unit tests for the deterministic risk calculator.
 * Run with: npm test   (tsx --test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateAdvancedRisk, calculateRisk, FUTURES_SPECS, round2 } from './risk.js';

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

describe('calculateAdvancedRisk', () => {
  const base = {
    accountBalance: 10000,
    riskPercent: 1, // $100
    spec: FUTURES_SPECS.MES,
  };

  it('matches calculateRisk when no advanced options are used', () => {
    const input = { ...base, entryPrice: 6000, stopPrice: 5997.5, direction: 'long' as const };
    const adv = calculateAdvancedRisk(input);
    const plain = calculateRisk(input);
    assert.equal(adv.contracts, plain.contracts);
    assert.equal(adv.actualRisk, plain.actualRisk);
    assert.equal(adv.costPerContract, 0);
    assert.equal(adv.effectiveRiskAmount, plain.riskAmount);
  });

  it('rejects a stop on the wrong side of entry', () => {
    const r = calculateAdvancedRisk({
      ...base,
      entryPrice: 6000,
      stopPrice: 6005, // above entry on a long = wrong side
      direction: 'long',
    });
    assert.equal(r.contracts, 0);
    assert.ok(r.warnings.some((w) => w.includes('wrong side')));
    const okShort = calculateAdvancedRisk({
      ...base,
      entryPrice: 6000,
      stopPrice: 6005,
      direction: 'short',
    });
    assert.ok(okShort.contracts > 0);
  });

  it('accounts commission and slippage in sizing', () => {
    const noCost = calculateAdvancedRisk({
      ...base, entryPrice: 6000, stopPrice: 5997.5, direction: 'long',
    });
    const withCost = calculateAdvancedRisk({
      ...base, entryPrice: 6000, stopPrice: 5997.5, direction: 'long',
      commissionPerContract: 4.2, slippageTicks: 2, // 4.20 + 2*1.25 = $6.70/contract
    });
    assert.equal(withCost.costPerContract, 6.7);
    assert.ok(withCost.contracts <= noCost.contracts);
    assert.equal(withCost.totalCosts, round2(withCost.contracts * 6.7));
  });

  it('caps risk with maxRiskPerTrade', () => {
    const r = calculateAdvancedRisk({
      ...base, entryPrice: 6000, stopPrice: 5997.5, direction: 'long',
      maxRiskPerTrade: 50,
    });
    assert.equal(r.effectiveRiskAmount, 50);
    assert.ok(r.warnings.some((w) => w.includes('Capped by max risk')));
    // 10 ticks x $1.25 = $12.50/contract -> floor(50/12.5) = 4
    assert.equal(r.contracts, 4);
  });

  it('warns when the trade exceeds the remaining daily budget', () => {
    const r = calculateAdvancedRisk({
      ...base, entryPrice: 6000, stopPrice: 5997.5, direction: 'long',
      dailyRiskBudget: 30, // $100 trade vs $30 left
    });
    assert.equal(r.maxContractsByDailyBudget, 2); // floor(30/12.5)
    assert.ok(r.warnings.some((w) => w.includes('daily budget')));
  });

  it('tracks trailing drawdown and warns near the floor', () => {
    const r = calculateAdvancedRisk({
      ...base, entryPrice: 6000, stopPrice: 5997.5, direction: 'long',
      drawdown: { maxDrawdown: 2000, trailing: true, peakBalance: 12000, currentBalance: 10500 },
    });
    // floor = 12000-2000 = 10000; remaining = 10500-10000 = 500
    assert.equal(r.remainingDrawdown, 500);
    assert.equal(r.drawdownBreached, false);
    assert.ok(!r.warnings.some((w) => w.includes('drawdown')));
  });

  it('flags a breached drawdown', () => {
    const r = calculateAdvancedRisk({
      ...base, entryPrice: 6000, stopPrice: 5997.5, direction: 'long',
      drawdown: { maxDrawdown: 2000, trailing: true, peakBalance: 12000, currentBalance: 9900 },
    });
    assert.equal(r.drawdownBreached, true);
    assert.ok(r.warnings.some((w) => w.includes('breached')));
  });

  it('warns on excessively distant stops', () => {
    const r = calculateAdvancedRisk({
      ...base, entryPrice: 6000, stopPrice: 6200, direction: 'short', // 3.3% away
      spec: FUTURES_SPECS.ES,
    });
    assert.ok(r.warnings.some((w) => w.includes('unusually distant')));
  });

  it('never recommends raising risk to force a trade', () => {
    const r = calculateAdvancedRisk({
      accountBalance: 5000, riskPercent: 1, // $50
      entryPrice: 6000, stopPrice: 5998, // $100/contract on ES
      spec: FUTURES_SPECS.ES, direction: 'long',
    });
    assert.equal(r.contracts, 0);
    assert.ok(r.warnings.some((w) => w.toLowerCase().includes('do not raise risk')));
    assert.ok(!r.warnings.some((w) => w.includes('Raise risk %')));
  });

  it('is deterministic', () => {
    const input = {
      ...base, entryPrice: 6012.25, stopPrice: 6005.5, direction: 'long' as const,
      commissionPerContract: 2.5, dailyRiskBudget: 200,
      drawdown: { maxDrawdown: 1500, trailing: false, peakBalance: 10000, currentBalance: 9800 },
    };
    assert.deepEqual(calculateAdvancedRisk(input), calculateAdvancedRisk(input));
  });
});
