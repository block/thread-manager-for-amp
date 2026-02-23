import { readFile } from 'fs/promises';
import { join } from 'path';
import { THREADS_DIR, type ThreadFile, isToolUseContent } from './threadTypes.js';
import {
  calculateCost,
  isHiddenCostTool,
  TOOL_COST_ESTIMATES,
  estimateTaskCost,
} from '../../shared/cost.js';
import { DEFAULT_MAX_CONTEXT_TOKENS } from '../../shared/constants.js';

export interface TurnStats {
  turn: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  contextTokens: number;
  maxContextTokens: number;
  contextPercent: number;
  cost: number;
}

export interface ToolStats {
  name: string;
  count: number;
  estimatedCost: number;
}

export interface ContextAnalysis {
  threadId: string;
  model: string;
  totalTurns: number;
  totalCost: number;
  tokenBreakdown: {
    totalInput: number;
    totalOutput: number;
    totalCacheCreation: number;
    totalCacheRead: number;
    cacheHitRate: number;
  };
  context: {
    currentTokens: number;
    maxTokens: number;
    percent: number;
  };
  turns: TurnStats[];
  tools: ToolStats[];
  costBreakdown: {
    tokenCost: number;
    toolCost: number;
  };
}

export async function analyzeContext(threadId: string): Promise<ContextAnalysis> {
  const threadPath = join(THREADS_DIR, `${threadId}.json`);
  const content = await readFile(threadPath, 'utf-8');
  const data = JSON.parse(content) as ThreadFile;

  const tags = data.env?.initial?.tags || [];
  const modelTag = tags.find((t: string) => t.startsWith('model:'));
  const isOpus = modelTag ? modelTag.includes('opus') : true;
  const model = modelTag ? modelTag.replace('model:', '') : 'unknown';

  const messages = data.messages || [];
  const turns: TurnStats[] = [];
  const toolCounts: Record<string, number> = {};
  const taskPromptLengths: number[] = [];

  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheCreation = 0;
  let totalCacheRead = 0;
  let latestContextTokens = 0;
  let latestMaxTokens = DEFAULT_MAX_CONTEXT_TOKENS;
  let turnNumber = 0;

  for (const msg of messages) {
    if (msg.usage) {
      turnNumber++;
      const input = msg.usage.inputTokens || 0;
      const output = msg.usage.outputTokens || 0;
      const cacheCreation = msg.usage.cacheCreationInputTokens || 0;
      const cacheRead = msg.usage.cacheReadInputTokens || 0;
      const contextTokens = msg.usage.totalInputTokens || input + cacheCreation + cacheRead;
      const maxTokens = msg.usage.maxInputTokens || DEFAULT_MAX_CONTEXT_TOKENS;

      totalInput += input;
      totalOutput += output;
      totalCacheCreation += cacheCreation;
      totalCacheRead += cacheRead;
      latestContextTokens = contextTokens;
      latestMaxTokens = maxTokens;

      const turnCost = calculateCost({
        inputTokens: input,
        cacheCreationTokens: cacheCreation,
        cacheReadTokens: cacheRead,
        outputTokens: output,
        isOpus,
        turns: 1,
      });

      turns.push({
        turn: turnNumber,
        inputTokens: input,
        outputTokens: output,
        cacheCreationTokens: cacheCreation,
        cacheReadTokens: cacheRead,
        contextTokens,
        maxContextTokens: maxTokens,
        contextPercent: maxTokens > 0 ? Math.round((contextTokens / maxTokens) * 100) : 0,
        cost: turnCost,
      });
    }

    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === 'string') continue;
        if (isToolUseContent(block) && block.name) {
          toolCounts[block.name] = (toolCounts[block.name] || 0) + 1;
          if (block.name === 'Task' && block.input) {
            const prompt = typeof block.input.prompt === 'string' ? block.input.prompt : '';
            taskPromptLengths.push(prompt.length);
          }
        }
      }
    }
  }

  // Calculate costs
  const tokenCost = calculateCost({
    inputTokens: totalInput,
    cacheCreationTokens: totalCacheCreation,
    cacheReadTokens: totalCacheRead,
    outputTokens: totalOutput,
    isOpus,
    turns: turnNumber,
  });

  let toolCost = 0;
  const toolStats: ToolStats[] = [];
  let taskIdx = 0;

  for (const [name, count] of Object.entries(toolCounts).sort((a, b) => b[1] - a[1])) {
    let estimatedCost = 0;
    if (isHiddenCostTool(name)) {
      if (name === 'Task') {
        for (let i = 0; i < count; i++) {
          const len = taskPromptLengths[taskIdx++] || 0;
          estimatedCost += estimateTaskCost(len);
        }
      } else {
        estimatedCost = (TOOL_COST_ESTIMATES[name] || 0) * count;
      }
      toolCost += estimatedCost;
    }
    toolStats.push({ name, count, estimatedCost });
  }

  const totalCacheInput = totalCacheCreation + totalCacheRead;
  const cacheHitRate = totalCacheInput > 0 ? totalCacheRead / totalCacheInput : 0;

  return {
    threadId,
    model,
    totalTurns: turnNumber,
    totalCost: tokenCost + toolCost,
    tokenBreakdown: {
      totalInput,
      totalOutput,
      totalCacheCreation,
      totalCacheRead,
      cacheHitRate,
    },
    context: {
      currentTokens: latestContextTokens,
      maxTokens: latestMaxTokens,
      percent: latestMaxTokens > 0 ? Math.round((latestContextTokens / latestMaxTokens) * 100) : 0,
    },
    turns,
    tools: toolStats,
    costBreakdown: {
      tokenCost,
      toolCost,
    },
  };
}
