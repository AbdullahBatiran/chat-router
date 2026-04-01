import 'dotenv/config';
import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';

import { buildConversationRoutes } from './routes/conversations.js';

const port = Number(process.env.PORT ?? '3000');

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

await app.register(cors, {
  origin: true,
});

await app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
});

app.get('/healthz', async () => ({ ok: true }));

await app.register(buildConversationRoutes, { prefix: '/v1' });

app.setNotFoundHandler(async (req, reply) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    return reply.sendFile('index.html');
  }
  return reply.code(404).send({ error: 'not_found' });
});

await app.listen({ port, host: '0.0.0.0' });
