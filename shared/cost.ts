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

// Flat per-call estimates for tools with hidden LLM usage (except Task,
// which uses prompt-length scaling — see estimateTaskCost below).
export const TOOL_COST_ESTIMATES: Record<string, number> = {
  Task: 2.00,           // Fallback when prompt length unknown (see estimateTaskCost)
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

// Task prompt-length thresholds for cost scaling.
// Longer prompts correlate with more complex subagent work (more tool
// calls, more inference turns). Empirically calibrated against threads
// with known Amp CLI reported costs.
const TASK_COST_TIERS: { maxChars: number; cost: number }[] = [
  { maxChars: 500,  cost: 0.75 },   // Simple: git rebase, status check
  { maxChars: 2000, cost: 2.00 },   // Medium: focused edits, single-file
  { maxChars: 4000, cost: 4.00 },   // Complex: multi-file implementation
  { maxChars: Infinity, cost: 7.00 }, // Very complex: full feature impl
];

export function estimateTaskCost(promptLength: number): number {
  for (const tier of TASK_COST_TIERS) {
    if (promptLength < tier.maxChars) return tier.cost;
  }
  const lastTier = TASK_COST_TIERS[TASK_COST_TIERS.length - 1];
  return lastTier?.cost ?? 0;
}

// ── Per-turn overhead ────────────────────────────────────────────────────
// Each inference turn has ~15K system prompt tokens that are recorded as
// "cache reads" in thread JSON, but on the first turn of a session (or
// when the cache expires) Amp actually creates the cache at the higher
// cache_creation rate. This per-turn overhead accounts for that gap.
// Empirically: 15K tokens × (cache_creation - cache_read) rate ≈ $0.086.
const OPUS_TURN_OVERHEAD = 0.09;    // ~15K tokens × $5.75/MTok delta
const SONNET_TURN_OVERHEAD = 0.05;  // ~15K tokens × $3.45/MTok delta

// ── Types ───────────────────────────────────────────────────────────────

export interface CostInput {
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  isOpus: boolean;
  turns?: number;
}

export interface ToolCostCounts {
  [toolName: string]: number;
}

// ── Public API ──────────────────────────────────────────────────────────

export function calculateCost(tokens: CostInput): number {
  const { inputTokens, cacheCreationTokens, cacheReadTokens, outputTokens, isOpus, turns = 0 } = tokens;

  if (isOpus) {
    return (
      inputTokens * OPUS_INPUT_RATE +
      cacheCreationTokens * OPUS_CACHE_CREATION_RATE +
      cacheReadTokens * OPUS_CACHE_READ_RATE +
      outputTokens * OPUS_OUTPUT_RATE +
      turns * OPUS_TURN_OVERHEAD
    );
  }

  return (
    inputTokens * SONNET_INPUT_RATE +
    cacheCreationTokens * SONNET_CACHE_CREATION_RATE +
    cacheReadTokens * SONNET_CACHE_READ_RATE +
    outputTokens * SONNET_OUTPUT_RATE +
    turns * SONNET_TURN_OVERHEAD
  );
}

export function estimateToolCosts(
  toolCounts: ToolCostCounts,
  taskPromptLengths?: number[],
): number {
  let total = 0;
  for (const [tool, count] of Object.entries(toolCounts)) {
    if (tool === 'Task' && taskPromptLengths && taskPromptLengths.length > 0) {
      continue; // handled below with per-prompt scaling
    }
    const perCall = TOOL_COST_ESTIMATES[tool];
    if (perCall) {
      total += perCall * count;
    }
  }
  if (taskPromptLengths && taskPromptLengths.length > 0) {
    for (const len of taskPromptLengths) {
      total += estimateTaskCost(len);
    }
  }
  return total;
}

export function isHiddenCostTool(toolName: string): boolean {
  return toolName in TOOL_COST_ESTIMATES;
}
