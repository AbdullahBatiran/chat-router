import type { Conversation } from '../store/ConversationStore.js';
import type { BookingBackendClient } from '../booking/BookingBackendClient.js';
import type { LLMProvider, ToolCall } from '../llm/LLMProvider.js';
import { executeTool, getToolDefinitions } from '../tools/toolRegistry.js';

export type OrchestratorResult = {
  replyText: string;
  toolCalls: ToolCall[];
  toolResults: unknown[];
};

export class Orchestrator {
  constructor(
    private readonly llm: LLMProvider,
    private readonly booking: BookingBackendClient
  ) {}

  async runTurn(input: {
    conversation: Conversation;
  }): Promise<OrchestratorResult> {
    const system = [
      'You are a booking assistant for sports resources (football fields, padel courts, etc).',
      'Be concise and helpful. If you need availability or to book, use a tool call.',
      'Only call tools with valid JSON arguments matching the tool schema.',
    ].join('\n');

    const tools = getToolDefinitions();
    const contextMessages = input.conversation.messages.map((m) => ({
      role: m.role === 'tool' ? 'tool' : m.role,
      text: m.text,
    })) as Array<{ role: 'user' | 'assistant' | 'tool'; text: string }>;

    const toolCalls: ToolCall[] = [];
    const toolResults: unknown[] = [];

    // Simple loop: allow at most one tool call, then final message.
    const first = await this.llm.generateNext({
      system,
      messages: contextMessages,
      tools,
    });

    if (first.type === 'message') {
      return { replyText: first.text, toolCalls, toolResults };
    }

    toolCalls.push(first.toolCall);
    const toolResult = await executeTool(this.booking, first.toolCall);
    toolResults.push(toolResult);

    const toolResultText = JSON.stringify(toolResult);
    const second = await this.llm.generateNext({
      system,
      messages: [
        ...contextMessages,
        { role: 'tool', text: toolResultText },
      ],
      tools,
    });

    if (second.type === 'message') {
      return { replyText: second.text, toolCalls, toolResults };
    }

    // If model tries to call tools again, fall back to a safe reply for MVP.
    return {
      replyText:
        'I checked that for you. Can you confirm the resource and preferred start time?',
      toolCalls,
      toolResults,
    };
  }
}

