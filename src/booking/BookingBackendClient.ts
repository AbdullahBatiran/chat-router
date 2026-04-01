import { z } from 'zod';

export type Resource = {
  id: string;
  name: string;
  kind: 'football' | 'padel' | 'tennis' | 'other';
};

export type AvailabilitySlot = {
  start: string; // ISO
  durationMins: number;
};

export type Reservation = {
  id: string;
  resourceId: string;
  start: string; // ISO
  durationMins: number;
  userName: string;
  phone?: string;
  createdAt: string;
};

const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['football', 'padel', 'tennis', 'other']),
});

const AvailabilitySlotSchema = z.object({
  start: z.string(),
  durationMins: z.number().int().positive(),
});

const ReservationSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  start: z.string(),
  durationMins: z.number().int().positive(),
  userName: z.string(),
  phone: z.string().optional(),
  createdAt: z.string(),
});

export class BookingBackendClient {
  constructor(private readonly baseUrl: string) {}

  async listResources(): Promise<Resource[]> {
    const res = await fetch(`${this.baseUrl}/v1/resources`);
    if (!res.ok) throw new Error(`booking_backend_error:${res.status}`);
    const json = await res.json();
    return z.array(ResourceSchema).parse(json);
  }

  async checkAvailability(input: {
    resourceId: string;
    date: string; // YYYY-MM-DD
    durationMins: number;
  }): Promise<AvailabilitySlot[]> {
    const url = new URL(`${this.baseUrl}/v1/availability`);
    url.searchParams.set('resourceId', input.resourceId);
    url.searchParams.set('date', input.date);
    url.searchParams.set('durationMins', String(input.durationMins));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`booking_backend_error:${res.status}`);
    const json = await res.json();
    return z.array(AvailabilitySlotSchema).parse(json);
  }

  async createReservation(input: {
    resourceId: string;
    start: string; // ISO
    durationMins: number;
    userName: string;
    phone?: string;
  }): Promise<Reservation> {
    const res = await fetch(`${this.baseUrl}/v1/reservations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`booking_backend_error:${res.status}`);
    const json = await res.json();
    return ReservationSchema.parse(json);
  }
}

