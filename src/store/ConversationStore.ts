import { randomUUID } from 'node:crypto';

export type ConversationRole = 'user' | 'assistant' | 'tool';

export type ConversationMessage = {
  id: string;
  role: ConversationRole;
  text: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  createdAt: string;
  messages: ConversationMessage[];
};

export interface ConversationStore {
  createConversation(): Conversation;
  getConversation(id: string): Conversation | null;
  appendMessage(
    conversationId: string,
    msg: Omit<ConversationMessage, 'id' | 'createdAt'>
  ): ConversationMessage;
}

export class InMemoryConversationStore implements ConversationStore {
  private conversations = new Map<string, Conversation>();

  createConversation(): Conversation {
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: randomUUID(),
      createdAt: now,
      messages: [],
    };
    this.conversations.set(conv.id, conv);
    return conv;
  }

  getConversation(id: string): Conversation | null {
    return this.conversations.get(id) ?? null;
  }

  appendMessage(
    conversationId: string,
    msg: Omit<ConversationMessage, 'id' | 'createdAt'>
  ): ConversationMessage {
    const conv = this.conversations.get(conversationId);
    if (!conv) throw new Error('conversation_not_found');
    const created: ConversationMessage = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...msg,
    };
    conv.messages.push(created);
    return created;
  }
}

