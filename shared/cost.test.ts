import { describe, it, expect } from 'vitest';
import { calculateCost, type CostInput } from './cost.js';

describe('calculateCost', () => {
  it('calculates opus pricing correctly', () => {
    const input: CostInput = {
      inputTokens: 1_000_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      isOpus: true,
    };
    expect(calculateCost(input)).toBeCloseTo(5.0, 6);
  });

  it('calculates sonnet pricing correctly', () => {
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

  it('calculates opus output cost correctly', () => {
    const input: CostInput = {
      inputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1_000_000,
      isOpus: true,
    };
    expect(calculateCost(input)).toBeCloseTo(25.0, 6);
  });

  it('calculates sonnet output cost correctly', () => {
    const input: CostInput = {
      inputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1_000_000,
      isOpus: false,
    };
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
    // 100k * 5/1M + 500k * 6.25/1M + 400k * 1.5/1M + 50k * 25/1M
    // = 0.5 + 3.125 + 0.6 + 1.25 = 5.475
    expect(calculateCost(input)).toBeCloseTo(5.475, 6);
  });

  it('calculates cache-heavy sonnet workload', () => {
    const input: CostInput = {
      inputTokens: 100_000,
      cacheCreationTokens: 500_000,
      cacheReadTokens: 400_000,
      outputTokens: 50_000,
      isOpus: false,
    };
    // 100k * 3/1M + 500k * 3.75/1M + 400k * 0.3/1M + 50k * 15/1M
    // = 0.3 + 1.875 + 0.12 + 0.75 = 3.045
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
    // 10k * 5/1M + 20k * 6.25/1M + 80k * 1.5/1M + 5k * 25/1M
    // = 0.05 + 0.125 + 0.12 + 0.125 = 0.42
    expect(calculateCost(input)).toBeCloseTo(0.42, 6);
  });

  it('matches the original inline opus formula: (input*5 + cache*6.25 + read*1.5 + output*25) / 1M', () => {
    const input = 50_000;
    const cacheCreation = 30_000;
    const cacheRead = 120_000;
    const output = 8_000;

    const inlineResult = (input * 5 + cacheCreation * 6.25 + cacheRead * 1.5 + output * 25) / 1_000_000;
    const functionResult = calculateCost({
      inputTokens: input,
      cacheCreationTokens: cacheCreation,
      cacheReadTokens: cacheRead,
      outputTokens: output,
      isOpus: true,
    });

    expect(functionResult).toBeCloseTo(inlineResult, 10);
  });

  it('matches the original inline sonnet formula: (input*3 + cache*3.75 + read*0.3 + output*15) / 1M', () => {
    const input = 50_000;
    const cacheCreation = 30_000;
    const cacheRead = 120_000;
    const output = 8_000;

    const inlineResult = (input * 3 + cacheCreation * 3.75 + cacheRead * 0.3 + output * 15) / 1_000_000;
    const functionResult = calculateCost({
      inputTokens: input,
      cacheCreationTokens: cacheCreation,
      cacheReadTokens: cacheRead,
      outputTokens: output,
      isOpus: false,
    });

    expect(functionResult).toBeCloseTo(inlineResult, 10);
  });
});
