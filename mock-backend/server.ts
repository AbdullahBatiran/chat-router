import 'dotenv/config';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const port = Number(process.env.MOCK_BACKEND_PORT ?? '4000');

type Resource = {
  id: string;
  name: string;
  kind: 'football' | 'padel' | 'tennis' | 'other';
};

type Reservation = {
  id: string;
  resourceId: string;
  start: string; // ISO
  durationMins: number;
  userName: string;
  phone?: string;
  createdAt: string;
};

const resources: Resource[] = [
  { id: 'padel-1', name: 'Padel Court 1', kind: 'padel' },
  { id: 'football-1', name: 'Football Field 1', kind: 'football' },
  { id: 'tennis-1', name: 'Tennis Court 1', kind: 'tennis' },
];

const reservations = new Map<string, Reservation>();

function overlaps(aStart: Date, aDur: number, bStart: Date, bDur: number): boolean {
  const aEnd = new Date(aStart.getTime() + aDur * 60_000);
  const bEnd = new Date(bStart.getTime() + bDur * 60_000);
  return aStart < bEnd && bStart < aEnd;
}

function buildDailySlots(date: string, durationMins: number): Array<{ start: string; durationMins: number }> {
  // UTC-based simple schedule: 17:00 -> 22:00 every 30 minutes
  const slots: Array<{ start: string; durationMins: number }> = [];
  for (let hour = 17; hour <= 21; hour++) {
    for (const min of [0, 30]) {
      const start = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`);
      const end = new Date(start.getTime() + durationMins * 60_000);
      const close = new Date(`${date}T22:00:00.000Z`);
      if (end <= close) slots.push({ start: start.toISOString(), durationMins });
    }
  }
  return slots;
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

app.get('/healthz', async () => ({ ok: true }));

app.get('/v1/resources', async () => resources);

app.get('/v1/availability', async (req, reply) => {
  const q = z
    .object({
      resourceId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      durationMins: z.coerce.number().int().positive().max(24 * 60),
    })
    .safeParse(req.query);

  if (!q.success) return reply.code(400).send({ error: 'invalid_query' });
  const { resourceId, date, durationMins } = q.data;

  const baseSlots = buildDailySlots(date, durationMins);
  const booked = [...reservations.values()].filter((r) => r.resourceId === resourceId);

  const available = baseSlots.filter((s) => {
    const sStart = new Date(s.start);
    return !booked.some((r) =>
      overlaps(sStart, durationMins, new Date(r.start), r.durationMins)
    );
  });

  return available;
});

app.post('/v1/reservations', async (req, reply) => {
  const body = z
    .object({
      resourceId: z.string().min(1),
      start: z.string().min(10),
      durationMins: z.number().int().positive().max(24 * 60),
      userName: z.string().min(1),
      phone: z.string().optional(),
    })
    .safeParse(req.body);

  if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
  const { resourceId, start, durationMins, userName, phone } = body.data;

  const resourceExists = resources.some((r) => r.id === resourceId);
  if (!resourceExists) return reply.code(404).send({ error: 'resource_not_found' });

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return reply.code(400).send({ error: 'invalid_start' });

  const conflict = [...reservations.values()].some((r) => {
    if (r.resourceId !== resourceId) return false;
    return overlaps(startDate, durationMins, new Date(r.start), r.durationMins);
  });
  if (conflict) return reply.code(409).send({ error: 'slot_unavailable' });

  const reservation: Reservation = {
    id: randomUUID(),
    resourceId,
    start: startDate.toISOString(),
    durationMins,
    userName,
    phone,
    createdAt: new Date().toISOString(),
  };
  reservations.set(reservation.id, reservation);
  return reservation;
});

app.get('/v1/reservations/:id', async (req, reply) => {
  const params = z.object({ id: z.string().min(1) }).safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'invalid_params' });
  const r = reservations.get(params.data.id);
  if (!r) return reply.code(404).send({ error: 'reservation_not_found' });
  return r;
});

await app.listen({ port, host: '0.0.0.0' });

