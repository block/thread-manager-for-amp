import { describe, it, expect } from 'vitest';
import { calculateCost, type CostInput } from './cost.js';

// Note: calculateCost applies a 3x THINKING_OUTPUT_MULTIPLIER to outputTokens
// to account for extended thinking tokens not tracked in thread files.

describe('calculateCost', () => {
  it('calculates opus pricing with thinking multiplier', () => {
    const input: CostInput = {
      inputTokens: 1_000_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      isOpus: true,
    };
    // Input only — no output multiplier effect
    expect(calculateCost(input)).toBeCloseTo(5.0, 6);
  });

  it('calculates sonnet pricing with thinking multiplier', () => {
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

  it('applies 5x thinking multiplier to opus output', () => {
    const input: CostInput = {
      inputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1_000_000,
      isOpus: true,
    };
    // 1M tokens * 5x multiplier * $25/MTok = $125
    expect(calculateCost(input)).toBeCloseTo(125.0, 6);
  });

  it('applies 5x thinking multiplier to sonnet output', () => {
    const input: CostInput = {
      inputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1_000_000,
      isOpus: false,
    };
    // 1M tokens * 5x multiplier * $15/MTok = $75
    expect(calculateCost(input)).toBeCloseTo(75.0, 6);
  });

  it('calculates cache-heavy opus workload', () => {
    const input: CostInput = {
      inputTokens: 100_000,
      cacheCreationTokens: 500_000,
      cacheReadTokens: 400_000,
      outputTokens: 50_000,
      isOpus: true,
    };
    // input: 100k * 5/1M = 0.5
    // cache write: 500k * 6.25/1M = 3.125
    // cache read: 400k * 0.5/1M = 0.2
    // output: 50k * 5 * 25/1M = 6.25
    expect(calculateCost(input)).toBeCloseTo(10.075, 6);
  });

  it('calculates cache-heavy sonnet workload', () => {
    const input: CostInput = {
      inputTokens: 100_000,
      cacheCreationTokens: 500_000,
      cacheReadTokens: 400_000,
      outputTokens: 50_000,
      isOpus: false,
    };
    // input: 100k * 3/1M = 0.3
    // cache write: 500k * 3.75/1M = 1.875
    // cache read: 400k * 0.3/1M = 0.12
    // output: 50k * 5 * 15/1M = 3.75
    expect(calculateCost(input)).toBeCloseTo(6.045, 6);
  });

  it('calculates typical mixed usage for opus', () => {
    const input: CostInput = {
      inputTokens: 10_000,
      cacheCreationTokens: 20_000,
      cacheReadTokens: 80_000,
      outputTokens: 5_000,
      isOpus: true,
    };
    // input: 10k * 5/1M = 0.05
    // cache write: 20k * 6.25/1M = 0.125
    // cache read: 80k * 0.5/1M = 0.04
    // output: 5k * 5 * 25/1M = 0.625
    expect(calculateCost(input)).toBeCloseTo(0.84, 6);
  });

  it('input-side cost is unaffected by thinking multiplier', () => {
    const withOutput: CostInput = {
      inputTokens: 100_000,
      cacheCreationTokens: 50_000,
      cacheReadTokens: 200_000,
      outputTokens: 10_000,
      isOpus: true,
    };
    const withoutOutput: CostInput = { ...withOutput, outputTokens: 0 };

    const inputOnlyCost = calculateCost(withoutOutput);
    const fullCost = calculateCost(withOutput);
    const outputPortion = fullCost - inputOnlyCost;

    // Output portion should be 10k * 5 * 25/1M = 1.25
    expect(outputPortion).toBeCloseTo(1.25, 6);
    // Input portion should be 100k*5 + 50k*6.25 + 200k*0.5 = 912500 / 1M = 0.9125
    expect(inputOnlyCost).toBeCloseTo(0.9125, 6);
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
