import { describe, it, expect } from 'vitest';
import { calculateCost, type CostInput } from './cost.js';

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

  it('calculates opus output pricing directly (no multiplier)', () => {
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

  it('calculates sonnet output pricing directly (no multiplier)', () => {
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
    // input: 100k * 5/1M = 0.5
    // cache write: 500k * 6.25/1M = 3.125
    // cache read: 400k * 0.5/1M = 0.2
    // output: 50k * 25/1M = 1.25
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
    // input: 100k * 3/1M = 0.3
    // cache write: 500k * 3.75/1M = 1.875
    // cache read: 400k * 0.3/1M = 0.12
    // output: 50k * 15/1M = 0.75
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
    // input: 10k * 5/1M = 0.05
    // cache write: 20k * 6.25/1M = 0.125
    // cache read: 80k * 0.5/1M = 0.04
    // output: 5k * 25/1M = 0.125
    expect(calculateCost(input)).toBeCloseTo(0.34, 6);
  });

  it('output cost scales linearly without hidden multiplier', () => {
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
    // Input portion: 100k*5 + 50k*6.25 + 200k*0.5 = 912500 / 1M = 0.9125
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
