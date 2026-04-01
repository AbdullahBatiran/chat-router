import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { BookingBackendClient } from '../booking/BookingBackendClient.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { createLLMProviderFromEnv } from '../llm/createProvider.js';
import { InMemoryConversationStore } from '../store/ConversationStore.js';

const MessageBodySchema = z.object({
  text: z.string().min(1).max(4000),
});

const ConversationParamsSchema = z.object({
  id: z.string().min(1),
});

export const buildConversationRoutes: FastifyPluginAsync = async (app) => {
  const store = new InMemoryConversationStore();
  const booking = new BookingBackendClient(
    process.env.MOCK_BACKEND_URL ?? 'http://localhost:4000'
  );
  const llm = createLLMProviderFromEnv();
  const orchestrator = new Orchestrator(llm, booking);

  app.post('/conversations', async () => {
    const conversation = store.createConversation();
    return { conversationId: conversation.id };
  });

  app.get('/conversations/:id', async (req, reply) => {
    const params = ConversationParamsSchema.parse(req.params);
    const conv = store.getConversation(params.id);
    if (!conv) return reply.code(404).send({ error: 'conversation_not_found' });
    return conv;
  });

  app.post('/conversations/:id/messages', async (req, reply) => {
    const params = ConversationParamsSchema.parse(req.params);
    const body = MessageBodySchema.parse(req.body);

    const conv = store.getConversation(params.id);
    if (!conv) return reply.code(404).send({ error: 'conversation_not_found' });

    store.appendMessage(params.id, { role: 'user', text: body.text });

    const updated = store.getConversation(params.id);
    if (!updated) return reply.code(404).send({ error: 'conversation_not_found' });

    const result = await orchestrator.runTurn({ conversation: updated });
    for (const tr of result.toolResults) {
      store.appendMessage(params.id, { role: 'tool', text: JSON.stringify(tr) });
    }
    const assistantMessage = store.appendMessage(params.id, {
      role: 'assistant',
      text: result.replyText,
    });

    return {
      replyText: result.replyText,
      assistantMessage,
      toolCalls: result.toolCalls,
    };
  });
};

