/**
 * TRADEOS AI — deterministic risk calculator.
 *
 * Pure functions only: no network, no storage, no randomness.
 * All money values are USD. Money results are rounded to cents.
 * "Deterministic" means: same input -> same output, every time.
 */

export interface FuturesSpec {
  /** e.g. "ES" */
  symbol: string;
  /** minimum price increment, e.g. 0.25 for ES */
  tickSize: number;
  /** USD per tick per contract, e.g. 12.5 for ES */
  tickValue: number;
}

/**
 * Common CME futures specs. Exchange-published values —
 * verify against your broker before trading live.
 */
export const FUTURES_SPECS: Record<string, FuturesSpec> = {
  ES: { symbol: 'ES', tickSize: 0.25, tickValue: 12.5 },
  MES: { symbol: 'MES', tickSize: 0.25, tickValue: 1.25 },
  NQ: { symbol: 'NQ', tickSize: 0.25, tickValue: 5 },
  MNQ: { symbol: 'MNQ', tickSize: 0.25, tickValue: 0.5 },
  YM: { symbol: 'YM', tickSize: 1, tickValue: 5 },
  MYM: { symbol: 'MYM', tickSize: 1, tickValue: 0.5 },
  RTY: { symbol: 'RTY', tickSize: 0.1, tickValue: 5 },
  GC: { symbol: 'GC', tickSize: 0.1, tickValue: 10 },
  CL: { symbol: 'CL', tickSize: 0.01, tickValue: 10 },
};

export interface RiskInput {
  accountBalance: number;
  /** percent of account risked, e.g. 1 = 1% */
  riskPercent: number;
  entryPrice: number;
  stopPrice: number;
  spec: FuturesSpec;
}

export interface RiskResult {
  /** USD the trader is willing to lose */
  riskAmount: number;
  /** |entry - stop| in price points */
  stopPoints: number;
  /** stop distance expressed in ticks */
  stopTicks: number;
  /** USD lost per contract if stopped out */
  lossPerContract: number;
  /** whole contracts that fit the risk (floored, never fractional) */
  contracts: number;
  /** contracts * lossPerContract */
  actualRisk: number;
  /** actualRisk as % of account */
  actualRiskPercent: number;
  /** human-readable problems; empty means the input is sane */
  warnings: string[];
}

/** Round money to cents, dodging float dust like 0.1 + 0.2. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isWholeTicks(ticks: number): boolean {
  return Math.abs(ticks - Math.round(ticks)) < 1e-9;
}

export function calculateRisk(input: RiskInput): RiskResult {
  const { accountBalance, riskPercent, entryPrice, stopPrice, spec } = input;
  const warnings: string[] = [];

  if (!(accountBalance > 0)) warnings.push('Account balance must be greater than 0.');
  if (!(riskPercent > 0 && riskPercent <= 100))
    warnings.push('Risk must be greater than 0% and at most 100%.');
  if (!Number.isFinite(entryPrice) || !Number.isFinite(stopPrice))
    warnings.push('Entry and stop must be valid numbers.');
  if (entryPrice === stopPrice) warnings.push('Stop price cannot equal entry price.');
  if (!(spec.tickSize > 0) || !(spec.tickValue > 0))
    warnings.push('Tick size and tick value must be greater than 0.');

  const valid = warnings.length === 0;
  const stopPoints = Math.abs(entryPrice - stopPrice);
  const stopTicks = spec.tickSize > 0 ? stopPoints / spec.tickSize : 0;
  const lossPerContract = round2(stopTicks * spec.tickValue);
  const riskAmount = round2(accountBalance * (riskPercent / 100));
  const contracts =
    valid && lossPerContract > 0 ? Math.floor(riskAmount / lossPerContract) : 0;

  if (valid && !isWholeTicks(stopTicks)) {
    warnings.push(
      `Stop distance is ${round2(stopTicks)} ticks — not on the ${spec.symbol} tick grid. Nudge the stop to a valid tick.`,
    );
  }
  if (valid && contracts === 0 && riskAmount > 0) {
    warnings.push(
      `Risk of $${riskAmount.toFixed(2)} is too small for 1 ${spec.symbol} contract ($${lossPerContract.toFixed(2)} risk). Raise risk % or tighten the stop.`,
    );
  }

  const actualRisk = round2(contracts * lossPerContract);
  const actualRiskPercent =
    accountBalance > 0 ? round2((actualRisk / accountBalance) * 100) : 0;

  return {
    riskAmount,
    stopPoints: round2(stopPoints),
    stopTicks: round2(stopTicks),
    lossPerContract,
    contracts,
    actualRisk,
    actualRiskPercent,
    warnings,
  };
}
