import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  estimateToolCosts,
  estimateTaskCost,
  isHiddenCostTool,
  TOOL_COST_ESTIMATES,
  type CostInput,
} from './cost.js';

describe('calculateCost', () => {
  it('calculates opus input-only pricing', () => {
    const input: CostInput = {
      inputTokens: 1_000_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      isOpus: true,
    };
    expect(calculateCost(input)).toBeCloseTo(5.0, 6);
  });

  it('calculates sonnet input-only pricing', () => {
    const input: CostInput = {
      inputTokens: 1_000_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      isOpus: false,
    };
    expect(calculateCost(input)).toBeCloseTo(3.0, 6);
  });

  it('returns 0 for zero tokens', () => {
    const input: CostInput = {
      inputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      isOpus: true,
    };
    expect(calculateCost(input)).toBe(0);
  });

  it('calculates opus output pricing directly', () => {
    const input: CostInput = {
      inputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1_000_000,
      isOpus: true,
    };
    // 1M tokens * $25/MTok = $25
    expect(calculateCost(input)).toBeCloseTo(25.0, 6);
  });

  it('calculates sonnet output pricing directly', () => {
    const input: CostInput = {
      inputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1_000_000,
      isOpus: false,
    };
    // 1M tokens * $15/MTok = $15
    expect(calculateCost(input)).toBeCloseTo(15.0, 6);
  });

  it('calculates cache-heavy opus workload', () => {
    const input: CostInput = {
      inputTokens: 100_000,
      cacheCreationTokens: 500_000,
      cacheReadTokens: 400_000,
      outputTokens: 50_000,
      isOpus: true,
    };
    // input: 0.5 + cache write: 3.125 + cache read: 0.2 + output: 1.25 = 5.075
    expect(calculateCost(input)).toBeCloseTo(5.075, 6);
  });

  it('calculates cache-heavy sonnet workload', () => {
    const input: CostInput = {
      inputTokens: 100_000,
      cacheCreationTokens: 500_000,
      cacheReadTokens: 400_000,
      outputTokens: 50_000,
      isOpus: false,
    };
    // input: 0.3 + cache write: 1.875 + cache read: 0.12 + output: 0.75 = 3.045
    expect(calculateCost(input)).toBeCloseTo(3.045, 6);
  });

  it('calculates typical mixed usage for opus', () => {
    const input: CostInput = {
      inputTokens: 10_000,
      cacheCreationTokens: 20_000,
      cacheReadTokens: 80_000,
      outputTokens: 5_000,
      isOpus: true,
    };
    // input: 0.05 + cache write: 0.125 + cache read: 0.04 + output: 0.125 = 0.34
    expect(calculateCost(input)).toBeCloseTo(0.34, 6);
  });

  it('output cost scales linearly', () => {
    const base: CostInput = {
      inputTokens: 100_000,
      cacheCreationTokens: 50_000,
      cacheReadTokens: 200_000,
      outputTokens: 10_000,
      isOpus: true,
    };
    const noOutput: CostInput = { ...base, outputTokens: 0 };

    const inputOnlyCost = calculateCost(noOutput);
    const fullCost = calculateCost(base);
    const outputPortion = fullCost - inputOnlyCost;

    // Output portion should be 10k * 25/1M = 0.25
    expect(outputPortion).toBeCloseTo(0.25, 6);
    expect(inputOnlyCost).toBeCloseTo(0.9125, 6);
  });

  it('adds per-turn overhead for opus', () => {
    const base: CostInput = {
      inputTokens: 10,
      cacheCreationTokens: 9708,
      cacheReadTokens: 14974,
      outputTokens: 57,
      isOpus: true,
    };
    const withoutTurns = calculateCost(base);
    const withTurn = calculateCost({ ...base, turns: 1 });
    // 1 turn × $0.09 overhead
    expect(withTurn - withoutTurns).toBeCloseTo(0.09, 4);
    // Simple "haiku" thread: should be ~$0.16 with 1 turn
    expect(withTurn).toBeCloseTo(0.16, 1);
  });

  it('adds per-turn overhead for sonnet', () => {
    const base: CostInput = {
      inputTokens: 10,
      cacheCreationTokens: 9708,
      cacheReadTokens: 14974,
      outputTokens: 57,
      isOpus: false,
    };
    const withoutTurns = calculateCost(base);
    const withTurn = calculateCost({ ...base, turns: 1 });
    // 1 turn × $0.05 overhead
    expect(withTurn - withoutTurns).toBeCloseTo(0.05, 4);
  });

  it('opus is more expensive than sonnet for same tokens', () => {
    const tokens = {
      inputTokens: 50_000,
      cacheCreationTokens: 30_000,
      cacheReadTokens: 120_000,
      outputTokens: 8_000,
    };
    const opusCost = calculateCost({ ...tokens, isOpus: true });
    const sonnetCost = calculateCost({ ...tokens, isOpus: false });
    expect(opusCost).toBeGreaterThan(sonnetCost);
  });
});

describe('estimateToolCosts', () => {
  it('returns 0 for empty counts', () => {
    expect(estimateToolCosts({})).toBe(0);
  });

  it('uses flat fallback for Task when no prompt lengths provided', () => {
    expect(estimateToolCosts({ Task: 1 })).toBe(TOOL_COST_ESTIMATES.Task);
  });

  it('uses prompt-length scaling when taskPromptLengths provided', () => {
    // 1 simple task (300 chars → $0.75)
    const cost = estimateToolCosts({ Task: 1 }, [300]);
    expect(cost).toBeCloseTo(0.75, 6);
  });

  it('scales mixed-complexity tasks by prompt length', () => {
    // 3 tasks: simple (400 chars), medium (1500 chars), complex (5000 chars)
    const cost = estimateToolCosts({ Task: 3, oracle: 1 }, [400, 1500, 5000]);
    // 0.75 + 2.00 + 7.00 + oracle 0.50 = 10.25
    expect(cost).toBeCloseTo(10.25, 6);
  });

  it('estimates cost for multiple tool types without Task prompts', () => {
    const counts = { oracle: 1, finder: 3 };
    const expected =
      TOOL_COST_ESTIMATES.oracle * 1 +
      TOOL_COST_ESTIMATES.finder * 3;
    expect(estimateToolCosts(counts)).toBeCloseTo(expected, 6);
  });

  it('ignores unknown tool names', () => {
    expect(estimateToolCosts({ Bash: 10, Read: 5, unknown_tool: 3 })).toBe(0);
  });

  it('handles realistic subagent-heavy thread with prompt lengths', () => {
    // Simulating T-019c38e7: 4 complex Tasks + 1 oracle + 5 finder + 1 read_web_page
    const counts = { Task: 4, oracle: 1, finder: 5, read_web_page: 1 };
    const prompts = [5174, 4173, 5288, 4809]; // all >4000 chars → $7.00 each
    const cost = estimateToolCosts(counts, prompts);
    // 4*7.00 + 0.50 + 5*0.15 + 0.40 = 28.00 + 0.50 + 0.75 + 0.40 = 29.65
    expect(cost).toBeCloseTo(29.65, 6);
  });

  it('handles simple git-rebase thread with short prompts', () => {
    // 19 simple tasks (~450 chars each)
    const counts = { Task: 19 };
    const prompts = Array(19).fill(450); // all <500 → $0.75 each
    const cost = estimateToolCosts(counts, prompts);
    // 19 * 0.75 = 14.25
    expect(cost).toBeCloseTo(14.25, 6);
  });
});

describe('estimateTaskCost', () => {
  it('returns $0.75 for short prompts (<500 chars)', () => {
    expect(estimateTaskCost(100)).toBe(0.75);
    expect(estimateTaskCost(499)).toBe(0.75);
  });

  it('returns $2.00 for medium prompts (500–1999 chars)', () => {
    expect(estimateTaskCost(500)).toBe(2.00);
    expect(estimateTaskCost(1999)).toBe(2.00);
  });

  it('returns $4.00 for complex prompts (2000–3999 chars)', () => {
    expect(estimateTaskCost(2000)).toBe(4.00);
    expect(estimateTaskCost(3999)).toBe(4.00);
  });

  it('returns $7.00 for very complex prompts (4000+ chars)', () => {
    expect(estimateTaskCost(4000)).toBe(7.00);
    expect(estimateTaskCost(10000)).toBe(7.00);
  });

  it('returns $0.75 for zero-length prompt', () => {
    expect(estimateTaskCost(0)).toBe(0.75);
  });
});

describe('isHiddenCostTool', () => {
  it('identifies hidden-cost tools', () => {
    expect(isHiddenCostTool('Task')).toBe(true);
    expect(isHiddenCostTool('oracle')).toBe(true);
    expect(isHiddenCostTool('finder')).toBe(true);
    expect(isHiddenCostTool('librarian')).toBe(true);
    expect(isHiddenCostTool('web_search')).toBe(true);
  });

  it('rejects non-hidden-cost tools', () => {
    expect(isHiddenCostTool('Bash')).toBe(false);
    expect(isHiddenCostTool('Read')).toBe(false);
    expect(isHiddenCostTool('edit_file')).toBe(false);
    expect(isHiddenCostTool('Grep')).toBe(false);
    expect(isHiddenCostTool('glob')).toBe(false);
  });
});
