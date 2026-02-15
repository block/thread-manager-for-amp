// Cost calculation for Amp thread token usage.
// Centralises pricing logic that was previously duplicated in 3 places.

// ── Pricing rates (per token) ───────────────────────────────────────────

// Opus (Claude opus) pricing
const OPUS_INPUT_RATE = 5 / 1_000_000;           // $5 per 1M tokens
const OPUS_CACHE_CREATION_RATE = 6.25 / 1_000_000; // $6.25 per 1M tokens
const OPUS_CACHE_READ_RATE = 1.5 / 1_000_000;      // $1.50 per 1M tokens
const OPUS_OUTPUT_RATE = 25 / 1_000_000;            // $25 per 1M tokens

// Sonnet / non-opus pricing
const SONNET_INPUT_RATE = 3 / 1_000_000;            // $3 per 1M tokens
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
