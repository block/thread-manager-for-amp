// Cost calculation for Amp thread token usage.
// Centralises pricing logic that was previously duplicated in 3 places.
//
// Pricing source: https://www.anthropic.com/pricing
// Rates are for Opus 4.5/4.6 and Sonnet 4.5 (≤200K token prompts).
// Amp caps context at 168K tokens, so the >200K pricing tier never applies.
//
// ⚠️  Known limitation: When reading costs from thread JSON files (e.g. in
// listThreads), the `outputTokens` field only records VISIBLE (summarized)
// output — it does NOT include extended thinking tokens, which are billed as
// output tokens at $25/MTok for Opus. This causes thread list cost estimates
// to undercount by the amount of thinking token usage. The live WebSocket
// path (handleStreamEvent) receives billed output_tokens from the stream and
// should be more accurate.

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

// Extended thinking multiplier: the thread file's outputTokens only records
// visible/summarized output, not the full thinking tokens billed as output.
// Empirically, actual billed output is ~3x the visible count. This brings
// estimates closer to Amp's reported cost (within ~5%).
const THINKING_OUTPUT_MULTIPLIER = 3;

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
  const adjustedOutput = outputTokens * THINKING_OUTPUT_MULTIPLIER;

  if (isOpus) {
    return (
      inputTokens * OPUS_INPUT_RATE +
      cacheCreationTokens * OPUS_CACHE_CREATION_RATE +
      cacheReadTokens * OPUS_CACHE_READ_RATE +
      adjustedOutput * OPUS_OUTPUT_RATE
    );
  }

  return (
    inputTokens * SONNET_INPUT_RATE +
    cacheCreationTokens * SONNET_CACHE_CREATION_RATE +
    cacheReadTokens * SONNET_CACHE_READ_RATE +
    adjustedOutput * SONNET_OUTPUT_RATE
  );
}
