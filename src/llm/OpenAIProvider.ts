import type { LLMContext, LLMProvider, LLMTurn } from './LLMProvider.js';

type ResponsesMessageOutputItem = {
  type: 'message';
  content?: Array<{ type: string; text?: string }>;
};

type ResponsesFunctionCallOutputItem = {
  type: 'function_call';
  name: string;
  arguments: string;
};

type ResponsesUnknownOutputItem = {
  type: string;
  [k: string]: unknown;
};

type ResponsesOutputItem =
  | ResponsesMessageOutputItem
  | ResponsesFunctionCallOutputItem
  | ResponsesUnknownOutputItem;

type ResponsesCreateResponse = {
  output?: ResponsesOutputItem[];
  output_text?: string;
};

function getTextFromMessageItem(item: ResponsesMessageOutputItem): string {
  const chunks = item.content ?? [];
  const texts = chunks
    .map((c) => (typeof c.text === 'string' ? c.text : ''))
    .filter((text) => text.length > 0);
  return texts.join('');
}

function isFunctionCallOutputItem(item: ResponsesOutputItem): item is ResponsesFunctionCallOutputItem {
  return item.type === 'function_call' && typeof (item as ResponsesFunctionCallOutputItem).name === 'string';
}

function isMessageOutputItem(item: ResponsesOutputItem): item is ResponsesMessageOutputItem {
  return item.type === 'message';
}

export class OpenAIProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async generateNext(context: LLMContext): Promise<LLMTurn> {
    const tools = context.tools.map((t) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      // For MVP, we rely on the model + our server-side validation.
      parameters: { type: 'object' },
    }));

    const input = context.messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        instructions: context.system,
        input,
        tools,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`openai_error:${res.status}:${text}`);
    }

    const json = (await res.json()) as ResponsesCreateResponse;
    const output = json.output ?? [];

    for (const item of output) {
      if (isFunctionCallOutputItem(item)) {
        return {
          type: 'tool_call',
          toolCall: {
            name: item.name,
            args: item.arguments ? JSON.parse(item.arguments) : {},
          },
        };
      }
      if (isMessageOutputItem(item)) {
        const text = getTextFromMessageItem(item);
        if (text.trim()) return { type: 'message', text };
      }
    }

    if (typeof json.output_text === 'string' && json.output_text.trim()) {
      return { type: 'message', text: json.output_text };
    }

    return { type: 'message', text: 'Sorry—can you rephrase that?' };
  }
}

