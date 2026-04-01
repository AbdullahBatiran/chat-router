import { z } from 'zod';
import type { ToolDefinition, ToolCall } from '../llm/LLMProvider.js';
import type { BookingBackendClient } from '../booking/BookingBackendClient.js';

export const ToolNames = {
  ListResources: 'list_resources',
  CheckAvailability: 'check_availability',
  CreateReservation: 'create_reservation',
} as const;

export type ToolName = (typeof ToolNames)[keyof typeof ToolNames];

export type ToolExecutionResult =
  | { ok: true; name: ToolName; data: unknown }
  | { ok: false; name: ToolName; error: string };

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: ToolNames.ListResources,
      description: 'List available bookable resources (fields/courts).',
      argsSchema: z.object({}),
    },
    {
      name: ToolNames.CheckAvailability,
      description:
        'Check availability for a resource on a date with a duration.',
      argsSchema: z.object({
        resourceId: z.string().min(1),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date'),
        durationMins: z.number().int().positive().max(24 * 60),
      }),
    },
    {
      name: ToolNames.CreateReservation,
      description: 'Create a reservation for a resource at an ISO start time.',
      argsSchema: z.object({
        resourceId: z.string().min(1),
        start: z.string().min(10),
        durationMins: z.number().int().positive().max(24 * 60),
        userName: z.string().min(1).max(100),
        phone: z.string().min(3).max(30).optional(),
      }),
    },
  ];
}

export async function executeTool(
  booking: BookingBackendClient,
  toolCall: ToolCall
): Promise<ToolExecutionResult> {
  const defs = getToolDefinitions();
  const def = defs.find((d) => d.name === toolCall.name);
  if (!def) {
    return { ok: false, name: toolCall.name as ToolName, error: 'unknown_tool' };
  }

  const parsed = def.argsSchema.safeParse(toolCall.args);
  if (!parsed.success) {
    return {
      ok: false,
      name: def.name as ToolName,
      error: 'invalid_tool_args',
    };
  }

  try {
    switch (def.name as ToolName) {
      case ToolNames.ListResources: {
        const resources = await booking.listResources();
        return { ok: true, name: ToolNames.ListResources, data: resources };
      }
      case ToolNames.CheckAvailability: {
        const slots = await booking.checkAvailability(parsed.data);
        return { ok: true, name: ToolNames.CheckAvailability, data: slots };
      }
      case ToolNames.CreateReservation: {
        const reservation = await booking.createReservation(parsed.data);
        return { ok: true, name: ToolNames.CreateReservation, data: reservation };
      }
    }
  } catch (e) {
    return {
      ok: false,
      name: def.name as ToolName,
      error: e instanceof Error ? e.message : 'tool_execution_error',
    };
  }
}

