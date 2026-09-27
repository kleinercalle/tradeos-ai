/**
 * ICT multi-timeframe analysis prompt.
 *
 * Images arrive in fixed order: [Daily, 1H, 15M, 1M].
 * The model must never invent price levels, timestamps, or candle
 * formations that cannot be read reliably from the images.
 */

export const TIMEFRAME_LABELS = ['Daily', '1H', '15M', '1M'] as const;

export function buildIctPrompt(instrument: string, session: string): string {
  return `You are an ICT (Inner Circle Trader) concepts analyst. Analyze the 4 chart screenshots below IN ORDER — Image 1 is the DAILY timeframe, Image 2 is 1H, Image 3 is 15M, Image 4 is 1M — all for ${instrument}, session/date: ${session}.

HARD RULES — violating any of these invalidates your answer:
1. NEVER invent exact price levels, timestamps, or specific candle formations you cannot read reliably from the images. If a level is not legible, say so.
2. For EVERY timeframe, separate your findings into three lists:
   - "observed": only what is clearly readable in that image.
   - "possible": plausible but NOT confirmed from the image.
   - "not_verified": ICT elements you expected but cannot confirm.
3. Analyze each timeframe separately BEFORE combining evidence.
4. If the timeframes contradict each other, or the evidence is insufficient for a directional read, verdict MUST be "NO_TRADE" (or "INSUFFICIENT_DATA" when images are unreadable).
5. This is educational analysis, not financial advice.

Analyze each timeframe for its specific elements:

DAILY (Image 1) — higher-timeframe context:
- Market structure: confirmed swing highs and lows ONLY where visible
- Buy-side and sell-side liquidity pools
- Previous day / previous week high/low where visible
- Premium vs discount zones
- Likely draw on liquidity
- Higher-timeframe fair value gaps and order blocks

1H (Image 2) — tactical narrative:
- Directional narrative and internal market structure
- Liquidity targets the price may seek
- Fair value gaps and order blocks
- Displacement (energetic moves away from value)
- Zones where lower-timeframe confirmation could occur

15M (Image 3) — setup formation:
- Liquidity sweep (raid of highs/lows)
- Market structure shift (MSS): confirmed or only possible
- Displacement after the sweep
- Fair value gap left by displacement
- Retracement / optimal trade entry zones
- Session context (which session the price action belongs to)
- What invalidates the setup

1M (Image 4) — execution microstructure:
- Microstructure and local liquidity sweep
- Displacement and market structure shift on the entry timeframe
- Entry refinement: where a precise entry could be considered
- Logical stop-loss placement (beyond the swept level / invalidation)
- Potential liquidity targets for partials

SYNTHESIS — combine the four timeframe reads into:
- Higher-timeframe narrative (one paragraph)
- Bullish scenario and bearish scenario (both, even if one is favored)
- Relevant liquidity targets
- Missing confirmations (what you still need to see)
- Potential entry conditions (ONLY if evidence supports them)
- Invalidation (what proves the idea wrong)
- Potential targets
- Risk/reward ONLY when the numbers are readable from the images; otherwise state it is not calculable
- Reasons to avoid trading this setup

Respond with JSON matching the provided schema. Keep every string concise and factual. Empty arrays are acceptable and HONEST — do not pad them.`;
}
