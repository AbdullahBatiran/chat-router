import type { LLMContext, LLMProvider, LLMTurn, ToolCall } from './LLMProvider.js';

function isoDateFromRelative(word: string): string | null {
  const d = new Date();
  if (word === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (word === 'today') {
    // no-op
  } else return null;
  return d.toISOString().slice(0, 10);
}

function parseDurationMins(text: string): number | null {
  const m1 = text.match(/(\d{1,3})\s*(mins?|minutes?)\b/i);
  if (m1) return Number(m1[1]);
  const m2 = text.match(/\bfor\s+(\d{1,3})\b/i);
  if (m2) return Number(m2[1]);
  return null;
}

function parseUserName(text: string): string | null {
  const m = text.match(/\bunder\s+([a-zA-Z][a-zA-Z\s'-]{1,40})/i);
  return m ? m[1].trim() : null;
}

function parsePhone(text: string): string | null {
  const m = text.match(/\b(phone|mobile)\s*[:\-]?\s*([0-9+][0-9\s\-]{5,20})/i);
  return m ? m[2].replace(/\s+/g, '') : null;
}

function parseTimeToIso(date: string, text: string): string | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ampm = m[3].toLowerCase();
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  const iso = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`);
  return iso.toISOString();
}

function guessResourceId(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('padel')) return 'padel-1';
  if (t.includes('football') || t.includes('soccer')) return 'football-1';
  if (t.includes('tennis')) return 'tennis-1';
  return null;
}

export class StubProvider implements LLMProvider {
  async generateNext(context: LLMContext): Promise<LLMTurn> {
    const last = [...context.messages].reverse().find((m) => m.role === 'user');
    const toolMsg = [...context.messages].reverse().find((m) => m.role === 'tool');

    // If we just received a tool result, turn it into a user-facing response.
    if (toolMsg) {
      try {
        const obj = JSON.parse(toolMsg.text);
        if (obj?.ok && obj?.name === 'list_resources') {
          const lines = (obj.data ?? []).map((r: any) => `- ${r.name} (${r.id})`);
          return {
            type: 'message',
            text: lines.length ? `Here are the available resources:\n${lines.join('\n')}` : 'No resources found.',
          };
        }
        if (obj?.ok && obj?.name === 'check_availability') {
          const slots = obj.data ?? [];
          if (!slots.length) return { type: 'message', text: 'No slots available for that date/duration. Try a different day or duration.' };
          const preview = slots.slice(0, 5).map((s: any) => `- ${new Date(s.start).toISOString()}`).join('\n');
          return { type: 'message', text: `I found ${slots.length} slot(s). Here are a few options:\n${preview}\n\nTell me which start time you prefer, and your name to book it.` };
        }
        if (obj?.ok && obj?.name === 'create_reservation') {
          return { type: 'message', text: `Booked. Reservation id: ${obj.data?.id ?? '(unknown)'} at ${obj.data?.start ?? ''}.` };
        }
        if (!obj?.ok) {
          return { type: 'message', text: `I ran into an issue while checking: ${obj?.error ?? 'unknown_error'}.` };
        }
      } catch {
        // fall through
      }
    }

    const text = (last?.text ?? '').trim();
    const lower = text.toLowerCase();

    if (!text) return { type: 'message', text: 'How can I help you book a resource?' };

    if (lower.includes('list') && lower.includes('resource')) {
      const toolCall: ToolCall = { name: 'list_resources', args: {} };
      return { type: 'tool_call', toolCall };
    }

    if (lower.includes('available') || lower.includes('do you have') || lower.includes('availability')) {
      const resourceId = guessResourceId(text);
      const durationMins = parseDurationMins(text) ?? 90;
      const date =
        isoDateFromRelative(lower.includes('tomorrow') ? 'tomorrow' : lower.includes('today') ? 'today' : '') ??
        (text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null);

      if (!resourceId || !date) {
        return {
          type: 'message',
          text: 'Sure — which sport (padel/football/tennis) and which date (e.g. tomorrow or 2026-04-02)?',
        };
      }

      const toolCall: ToolCall = {
        name: 'check_availability',
        args: { resourceId, date, durationMins },
      };
      return { type: 'tool_call', toolCall };
    }

    if (lower.includes('book') || lower.includes('reserve')) {
      const resourceId = guessResourceId(text);
      const durationMins = parseDurationMins(text) ?? 90;
      const userName = parseUserName(text) ?? 'Guest';
      const phone = parsePhone(text) ?? undefined;
      const date =
        isoDateFromRelative(lower.includes('tomorrow') ? 'tomorrow' : lower.includes('today') ? 'today' : '') ??
        (text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null);

      if (!resourceId || !date) {
        return {
          type: 'message',
          text: 'To book, I need the sport and date/time. Example: “Book padel tomorrow 7pm for 90 minutes under Ahmed, phone 05xxxx”.',
        };
      }

      const start = parseTimeToIso(date, text);
      if (!start) {
        return { type: 'message', text: 'What start time should I book? (e.g. 7pm)' };
      }

      const toolCall: ToolCall = {
        name: 'create_reservation',
        args: { resourceId, start, durationMins, userName, phone },
      };
      return { type: 'tool_call', toolCall };
    }

    return {
      type: 'message',
      text: 'Tell me what you want to book (padel/football), the date/time, and duration — I can check availability and reserve it.',
    };
  }
}

