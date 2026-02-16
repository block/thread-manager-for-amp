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
// Several Amp tools (Task, oracle, finder, librarian, etc.) use separate
// LLM inference calls whose token usage is NOT recorded in the parent
// thread's JSON file. We estimate their costs using empirical per-call
// averages. These are rough approximations — actual costs vary by prompt
// complexity and number of turns.

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

// ── Estimated per-call costs for tools with hidden LLM usage ────────────
// These tools spawn separate inference calls whose tokens don't appear in
// the parent thread's usage data. Estimates are based on empirical analysis
// comparing visible thread costs to Amp CLI reported costs.

// Conservative estimates — intentionally low to avoid overcounting.
// Task cost varies wildly ($0.50 for a simple git rebase to $10+ for
// a complex multi-file implementation), so we use a low flat rate.
// Complex subagent-heavy threads will undercount; simple threads will
// be close to accurate.
export const TOOL_COST_ESTIMATES: Record<string, number> = {
  Task: 0.50,           // Full subagent session (actual range: $0.50–$10+)
  oracle: 0.50,         // Single GPT-5.2 reasoning call
  finder: 0.15,         // 1-3 LLM search calls
  librarian: 0.35,      // Multiple LLM calls with GitHub context
  read_thread: 0.10,    // 1 LLM extraction call
  find_thread: 0.03,    // Search query with minimal LLM
  web_search: 0.80,     // $0.01/search + LLM extraction + retrieval tokens
  read_web_page: 0.40,  // 1 LLM call for content extraction
  look_at: 0.10,        // 1 LLM call for image/doc analysis
  handoff: 0.10,        // 1 LLM call for context summary
};

// ── Types ───────────────────────────────────────────────────────────────

export interface CostInput {
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  isOpus: boolean;
}

export interface ToolCostCounts {
  [toolName: string]: number;
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

export function estimateToolCosts(toolCounts: ToolCostCounts): number {
  let total = 0;
  for (const [tool, count] of Object.entries(toolCounts)) {
    const perCall = TOOL_COST_ESTIMATES[tool];
    if (perCall) {
      total += perCall * count;
    }
  }
  return total;
}

export function isHiddenCostTool(toolName: string): boolean {
  return toolName in TOOL_COST_ESTIMATES;
}
