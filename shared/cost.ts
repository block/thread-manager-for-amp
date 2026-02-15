// Cost calculation for Amp thread token usage.
// Centralises pricing logic that was previously duplicated in 3 places.
//
// Pricing source: https://www.anthropic.com/pricing
// Rates are for Opus 4.5/4.6 and Sonnet 4.5 (≤200K token prompts).
// Amp caps context at 168K tokens, so the >200K pricing tier never applies.
//
// The `outputTokens` field in thread JSON files and in the --stream-json
// output already includes extended thinking tokens — no multiplier is needed.
//
// ⚠️  Known limitation: Subagent (Task tool) and Oracle costs are billed to
// the parent thread by Amp but their token usage is NOT recorded in the
// parent thread's JSON file. This means cost estimates will undercount for
// threads that heavily use subagents. There is currently no Amp API to
// retrieve the true billed cost per thread.

// ── Pricing rates (per token) ───────────────────────────────────────────

// Opus 4.5 pricing (≤200K token prompts)
const OPUS_INPUT_RATE = 5 / 1_000_000;              // $5 per 1M tokens
const OPUS_CACHE_CREATION_RATE = 6.25 / 1_000_000;  // $6.25 per 1M tokens
const OPUS_CACHE_READ_RATE = 0.5 / 1_000_000;       // $0.50 per 1M tokens
const OPUS_OUTPUT_RATE = 25 / 1_000_000;             // $25 per 1M tokens

// Sonnet / non-opus pricing (≤200K token prompts)
const SONNET_INPUT_RATE = 3 / 1_000_000;             // $3 per 1M tokens
const SONNET_CACHE_CREATION_RATE = 3.75 / 1_000_000; // $3.75 per 1M tokens
const SONNET_CACHE_READ_RATE = 0.3 / 1_000_000;      // $0.30 per 1M tokens
const SONNET_OUTPUT_RATE = 15 / 1_000_000;            // $15 per 1M tokens

// ── Types ───────────────────────────────────────────────────────────────

export interface CostInput {
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  isOpus: boolean;
}

// ── Public API ──────────────────────────────────────────────────────────

export function calculateCost(tokens: CostInput): number {
  const { inputTokens, cacheCreationTokens, cacheReadTokens, outputTokens, isOpus } = tokens;

  if (isOpus) {
    return (
      inputTokens * OPUS_INPUT_RATE +
      cacheCreationTokens * OPUS_CACHE_CREATION_RATE +
      cacheReadTokens * OPUS_CACHE_READ_RATE +
      outputTokens * OPUS_OUTPUT_RATE
    );
  }

  return (
    inputTokens * SONNET_INPUT_RATE +
    cacheCreationTokens * SONNET_CACHE_CREATION_RATE +
    cacheReadTokens * SONNET_CACHE_READ_RATE +
    outputTokens * SONNET_OUTPUT_RATE
  );
}
