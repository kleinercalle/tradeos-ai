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

/* =====================================================================
 * Advanced risk — Phase 3 (M2).
 *
 * Wraps calculateRisk() without changing it. Adds direction checks,
 * commission/slippage costs, per-trade caps, daily budget, and prop-firm
 * drawdown tracking. Pure functions, same determinism guarantees.
 * ===================================================================== */

export type Direction = 'long' | 'short';

export interface DrawdownConfig {
  /** max allowed drawdown in USD, e.g. 2000 */
  maxDrawdown: number;
  /** true = floor trails the peak balance; false = floor fixed from peakBalance as start */
  trailing: boolean;
  /** highest balance reached (or starting balance when trailing=false) */
  peakBalance: number;
  currentBalance: number;
}

export interface AdvancedRiskInput extends RiskInput {
  direction: Direction;
  /** round-trip commission in USD per contract, e.g. 4.20 */
  commissionPerContract?: number;
  /** assumed extra slippage in ticks per contract */
  slippageTicks?: number;
  /** hard USD cap per trade; overrides riskPercent-derived amount when lower */
  maxRiskPerTrade?: number;
  /** remaining daily risk budget in USD */
  dailyRiskBudget?: number;
  drawdown?: DrawdownConfig;
}

export interface AdvancedRiskResult extends RiskResult {
  direction: Direction;
  /** USD cost per contract: commission + slippage value */
  costPerContract: number;
  /** costPerContract * contracts */
  totalCosts: number;
  /** riskAmount after the maxRiskPerTrade cap */
  effectiveRiskAmount: number;
  /** whole contracts that fit the remaining daily budget (null when no budget set) */
  maxContractsByDailyBudget: number | null;
  /** remaining drawdown in USD (null when not configured) */
  remainingDrawdown: number | null;
  drawdownBreached: boolean;
}

/**
 * Heuristic: a stop wider than 2% of entry is flagged as unusually distant
 * for intraday futures. Documented, tunable, instrument-agnostic.
 */
export const DISTANT_STOP_FRACTION = 0.02;

export function calculateAdvancedRisk(input: AdvancedRiskInput): AdvancedRiskResult {
  const base = calculateRisk(input);
  // Drop base's "too small" advice (it suggests raising risk %); the
  // advanced version below replaces it with safer guidance.
  const warnings = base.warnings.filter((w) => !w.includes('too small'));
  const { direction, spec } = input;

  // 1. Direction: stop must sit on the correct side of entry.
  let directionOk = true;
  if (
    Number.isFinite(input.entryPrice) &&
    Number.isFinite(input.stopPrice) &&
    input.entryPrice !== input.stopPrice
  ) {
    directionOk =
      direction === 'long'
        ? input.stopPrice < input.entryPrice
        : input.stopPrice > input.entryPrice;
    if (!directionOk) {
      warnings.push(
        `Stop is on the wrong side of entry for a ${direction}: ` +
          (direction === 'long'
            ? 'a long needs the stop BELOW entry.'
            : 'a short needs the stop ABOVE entry.'),
      );
    }
  }

  // 2. Costs (opt-in; defaults keep results identical to calculateRisk).
  const commission = Math.max(0, input.commissionPerContract ?? 0);
  const slippageTicks = Math.max(0, input.slippageTicks ?? 0);
  const costPerContract = round2(commission + slippageTicks * spec.tickValue);

  // 3. Per-trade cap.
  const cap = input.maxRiskPerTrade;
  const capped = typeof cap === 'number' && cap > 0;
  const effectiveRiskAmount = capped ? Math.min(base.riskAmount, round2(cap)) : base.riskAmount;
  if (capped && round2(cap) < base.riskAmount) {
    warnings.push(
      `Capped by max risk/trade: $${round2(cap).toFixed(2)} instead of $${base.riskAmount.toFixed(2)}.`,
    );
  }

  // 4. Sizing: stop risk + costs must fit the effective risk.
  // sizingOk depends only on input validity + direction — not on base's
  // sizing-outcome warnings — so advanced checks still fire on 0-contract
  // trades instead of being swallowed.
  const inputOk =
    input.accountBalance > 0 &&
    input.riskPercent > 0 &&
    input.riskPercent <= 100 &&
    Number.isFinite(input.entryPrice) &&
    Number.isFinite(input.stopPrice) &&
    input.entryPrice !== input.stopPrice &&
    spec.tickSize > 0 &&
    spec.tickValue > 0;
  const sizingOk = inputOk && directionOk;
  const lossWithCosts = round2(base.lossPerContract + costPerContract);
  const contracts =
    sizingOk && lossWithCosts > 0 ? Math.floor(effectiveRiskAmount / lossWithCosts) : 0;
  const actualRisk = round2(contracts * base.lossPerContract);
  const actualRiskPercent =
    input.accountBalance > 0 ? round2((actualRisk / input.accountBalance) * 100) : 0;
  const totalCosts = round2(contracts * costPerContract);

  if (sizingOk && contracts === 0 && effectiveRiskAmount > 0) {
    warnings.push(
      `Risk of $${effectiveRiskAmount.toFixed(2)} is too small for 1 ${spec.symbol} contract ` +
        `($${lossWithCosts.toFixed(2)} risk). Tighten the stop, use micros, or skip — ` +
        `do not raise risk % to force it.`,
    );
  }

  // 5. Excessively distant stop.
  if (sizingOk && input.entryPrice > 0 && base.stopPoints / input.entryPrice > DISTANT_STOP_FRACTION) {
    warnings.push(
      `Stop is ${round2((base.stopPoints / input.entryPrice) * 100)}% away from entry — unusually distant for intraday futures. Double-check the stop price.`,
    );
  }

  // 6. Daily risk budget.
  let maxContractsByDailyBudget: number | null = null;
  if (typeof input.dailyRiskBudget === 'number' && input.dailyRiskBudget >= 0) {
    const budget = round2(input.dailyRiskBudget);
    maxContractsByDailyBudget = lossWithCosts > 0 ? Math.floor(budget / lossWithCosts) : 0;
    if (sizingOk && actualRisk > budget) {
      warnings.push(
        `This trade risks $${actualRisk.toFixed(2)} but only $${budget.toFixed(2)} of daily budget remains. ` +
          `At most ${maxContractsByDailyBudget} contract(s) fit the budget — never exceed it.`,
      );
    }
  }

  // 7. Prop-firm drawdown.
  let remainingDrawdown: number | null = null;
  let drawdownBreached = false;
  const dd = input.drawdown;
  if (dd && dd.maxDrawdown > 0 && dd.peakBalance > 0 && dd.currentBalance > 0) {
    const floor = round2(dd.peakBalance - dd.maxDrawdown);
    remainingDrawdown = round2(dd.currentBalance - floor);
    drawdownBreached = remainingDrawdown <= 0;
    if (drawdownBreached) {
      warnings.push(
        `Drawdown limit breached ($${remainingDrawdown.toFixed(2)} remaining). Stop trading this account.`,
      );
    } else if (sizingOk && actualRisk > remainingDrawdown) {
      warnings.push(
        `This trade risks $${actualRisk.toFixed(2)} but only $${remainingDrawdown.toFixed(2)} of drawdown remains${dd.trailing ? ' (trailing)' : ''}. Size down or skip.`,
      );
    }
  }

  return {
    ...base,
    direction,
    costPerContract,
    totalCosts,
    effectiveRiskAmount,
    maxContractsByDailyBudget,
    remainingDrawdown,
    drawdownBreached,
    contracts,
    actualRisk,
    actualRiskPercent,
    warnings,
  };
}
