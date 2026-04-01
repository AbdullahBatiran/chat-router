import type { z } from 'zod';

export type ToolDefinition = {
  name: string;
  description: string;
  argsSchema: z.ZodTypeAny;
};

export type ToolCall = {
  name: string;
  args: unknown;
};

export type LLMTurn =
  | { type: 'message'; text: string }
  | { type: 'tool_call'; toolCall: ToolCall };

export type LLMContext = {
  system: string;
  messages: Array<{ role: 'user' | 'assistant' | 'tool'; text: string }>;
  tools: ToolDefinition[];
};

export interface LLMProvider {
  generateNext(context: LLMContext): Promise<LLMTurn>;
}

