import type { LLMProvider } from './LLMProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { StubProvider } from './StubProvider.js';

export function createLLMProviderFromEnv(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER ?? 'stub').toLowerCase();
  if (provider === 'stub') return new StubProvider();

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY ?? '';
    const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
    if (!apiKey) {
      return new StubProvider();
    }
    return new OpenAIProvider(apiKey, model);
  }

  return new StubProvider();
}

