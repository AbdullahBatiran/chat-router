# chat-router

Chat Router MVP.

An extendable chat service that turns natural language into booking actions (availability checks + reservations) by calling a backend API. This repo includes a mock booking backend so you can test end-to-end locally.

### What’s included
- **Web chat UI** at `/` (static HTML)
- **Chat-router API** under `/v1/*`
- **Mock booking backend** under `mock-backend/`
- **Hybrid LLM**:
  - `LLM_PROVIDER=stub` (default): fast local intent/tool-calling
  - `LLM_PROVIDER=openai`: real model calls (requires `OPENAI_API_KEY`)

### Requirements
- Node.js 20+ (recommended 22+)

### Setup
From this directory:

```bash
npm install
cp .env.example .env
```

### Run (two terminals)

**Terminal A (mock backend):**

```bash
npm run mock-backend
```

**Terminal B (chat-router + web UI):**

```bash
npm run dev
```

Then open `http://localhost:3000`.

### Try it
In the web UI, try:
- “Do you have padel tomorrow at 7pm for 90 minutes?”
- “Book padel tomorrow 7pm for 90 minutes under Ahmed, phone 05xxxx”

### Environment variables
Copy `.env.example` to `.env`.

- `PORT`: chat-router port (default `3000`)
- `MOCK_BACKEND_URL`: mock booking backend base URL (default `http://localhost:4000`)
- `LLM_PROVIDER`: `stub` or `openai`
- `OPENAI_API_KEY`: required only when `LLM_PROVIDER=openai`
- `OPENAI_MODEL`: model name (default `gpt-4.1-mini`)
- `MOCK_BACKEND_PORT`: mock backend port (default `4000`)

### Chat-router API
- `POST /v1/conversations` -> `{ conversationId }`
- `GET /v1/conversations/:id` -> conversation + messages
- `POST /v1/conversations/:id/messages` -> `{ replyText, assistantMessage, toolCalls }`
- `GET /healthz`

Example (HTTP only):

```bash
curl -s -X POST http://localhost:3000/v1/conversations
```

```bash
curl -s -X POST "http://localhost:3000/v1/conversations/<id>/messages" \
  -H 'content-type: application/json' \
  -d '{"text":"Do you have padel tomorrow for 90 minutes?"}'
```

### Mock booking backend API
- `GET /v1/resources`
- `GET /v1/availability?resourceId&date&durationMins`
- `POST /v1/reservations`
- `GET /v1/reservations/:id`
- `GET /healthz`

Example:

```bash
curl -s "http://localhost:4000/v1/availability?resourceId=padel-1&date=2026-04-01&durationMins=90"
```

### Next extensions (suggested)
- Add phone/voice adapter (Twilio) that reuses the same orchestrator.
- Replace in-memory stores with SQLite/Postgres.
- Add multi-tenant orgs, resource calendars, cancellations/reschedules, payments.
