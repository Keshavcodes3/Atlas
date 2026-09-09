# Atlas — Team Knowledge + Action Engine

> One backend where a team connects docs / code / URLs, then queries and acts via permissioned agents. RAG + agents + evals, production-grade.

Built by **Keshav (Keshavcodes3)**. Backend-first, GenAI-powered. Designed to run lean on **8GB RAM, Windows 11, Docker**.

Atlas is a **mini-Notion + RAG + LangGraph agent runtime**. It absorbs two prior ideas as modules:
- `Mira` → agent loop (plan → act → verify + approvals + audit)
- `codebase-rag` → retrieval pipeline (ingest → chunk → embed → hybrid search + citations)

Chatbots answer. RAG demos search. Teams need more: **who can access what, what did it cost, was it correct, can the agent act safely.** Atlas answers all four.

---

## Table of Contents

- [Why Atlas](#why-atlas)
- [Key Features](#key-features)
- [Stack](#stack)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Core Data Models (Prisma)](#core-data-models-prisma)
- [Core APIs](#core-apis)
- [RBAC, Auth & Security](#rbac-auth--security)
- [AI Pipelines in Detail](#ai-pipelines-in-detail)
  - [1. Ingestion Pipeline](#1-ingestion-pipeline)
  - [2. Query / RAG Pipeline](#2-query--rag-pipeline)
  - [3. Agent Runtime](#3-agent-runtime)
  - [4. Memory Service](#4-memory-service)
  - [5. Eval Harness](#5-eval-harness)
- [Observability: Traces, Usage & Cost](#observability-traces-usage--cost)
- [Getting Started](#getting-started)
- [Configuration (Env Vars)](#configuration-env-vars)
- [Development Workflow](#development-workflow)
- [Testing, Evals & Load Tests](#testing-evals--load-tests)
- [Roadmap (12 Weeks)](#roadmap-12-weeks)
- [Done = MVP Success Criteria](#done--mvp-success-criteria)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Contributing](#contributing)
- [License & Author](#license--author)

---

## Why Atlas

**Problem with typical RAG demos:**
1. No multi-tenancy — one global index, no workspaces or permissions.
2. No action — can retrieve text but can't open a PR, update a doc, or file a ticket safely.
3. No accountability — no citations, no token/cost tracking, no audit log.
4. No quality loop — no evals, no feedback, hallucinations go unnoticed.
5. Heavy infra — separate vector DB + Mongo + cache + queue eats RAM.

**Atlas fixes this with 5 principles:**

1. **Workspace-first multi-tenancy:** Every document, chunk, trace, memory, and agent run belongs to a `Workspace`. RBAC (`owner / editor / viewer`) is enforced at the API + DB + retrieval filter level.
2. **Relational + vectors in one DB:** Postgres 18 + pgvector + Prisma. No Mongo, no Qdrant for MVP. Saves ~1GB RAM and one operational dependency. Add Qdrant later only if evals prove pgvector recall/latency is insufficient at scale.
3. **Hybrid retrieval with proof:** `tsvector` keyword + `pgvector <->` semantic + optional cross-encoder rerank. Every answer returns `citations[]` with `documentId`, `chunkId`, and span.
4. **Agents that ask permission:** LangGraph loop with explicit `approval` gates for side-effect tools, full `Trace` + audit log for every tool call, token, and cost.
5. **Cost + quality visible:** Per-request and per-workspace usage tracking, nightly eval harness with faithfulness / citation precision / refusal correctness scores.

---

## Key Features

### Workspaces & Collaboration
- Create workspaces, invite members with roles.
- API keys per workspace with hashed storage, scopes, expiry, and quotas.
- Rate-limit + monthly token / request quotas per workspace and per key.

### Universal Ingestion
- Sources: `file` (pdf/md/txt/docx), `url` (single page + sitemap crawl via Tavily), `github` (repo snapshot, branch, path filter).
- Async BullMQ jobs: `upload → parse → clean + PII-redact → chunk → embed → upsert pgvector`.
- Job status polling (`queued / processing / done / failed`), diff re-index for GitHub (hash + skip unchanged files).
- Document lifecycle: `pending → processing → ready → failed`, with error + retry count.

### Cited Q&A
- `POST /v1/query { q, topK, filters }` → `{ answer, citations[], usage }`.
- Semantic cache (Redis) for identical / near-duplicate queries to cut LLM cost.
- Streaming support (SSE) for dashboard UX.
- Guardrails: prompt-injection detector + PII filter on ingest and output.

### Agent Runtime (from Mira)
- `POST /v1/agent/run { goal, toolsAllowed, maxSteps }` → `{ runId, status, approvals[] }`.
- LangGraph 1.4 graph: `planner → retriever → actor → verifier → approver`.
- Tools are allow-listed per workspace (e.g. `github.createIssue`, `docs.update`, `web.search`).
- High-risk tools pause for human approval via dashboard. All steps append to immutable audit log.
- Agent can read Atlas knowledge (retriever tool) + external web (Tavily) + act via scoped tools.

### Memory
- Long-term `Memory { fact, confidence, version, workspaceId, userId }`.
- Auto-extracted from high-quality Q&A / agent runs, editable and versioned.
- Injected into query / agent context with confidence threshold.

### Evals, Traces & Cost
- `Trace` per LLM call: model, prompt/completion tokens, latency, cost USD, tool calls, retrieval IDs.
- `GET /v1/traces`, `GET /v1/usage?from&to` grouped by day/model/user.
- Nightly `EvalRun` on golden dataset: faithfulness, citation F1, latency p95, cost per query. Scores block deploys if regressed.

### Dashboard (Next.js 16)
- Workspace switcher, doc upload + job progress, cited chat UI with streaming.
- Agent run timeline with approve / reject buttons.
- Usage/cost charts, trace explorer, eval history.
- Tailwind + framer-motion for polish, demo-ready.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| **API** | Node 24, Express 5 ESM, zod, JWT + API keys, helmet/cors, pino | Lightweight, ESM-native, strict validation, structured logs. No NestJS overhead for MVP. |
| **DB** | Postgres 18 + pgvector + Prisma | One DB for relational + vectors. Prisma for migrations + type safety. `tsvector` for hybrid search without extra infra. |
| **Queue / Cache** | Redis + BullMQ | Ingestion workers, GitHub diff jobs, semantic cache, rate-limit buckets. Single Redis container. |
| **AI** | LangChain 1.5, LangGraph 1.4, `google-genai` / Groq / Mistral, Tavily search | LangGraph for stateful agent loop. Multi-provider LLMs for cost fallback (Gemini Flash default, Groq Llama for cheap, Mistral for EU). Tavily for fresh web + crawl. |
| **Dashboard** | Next.js 16, Tailwind, framer-motion | App Router, server components for traces/usage, streaming chat. |
| **Infra** | Docker Compose (pg + redis only), k6 for load tests | Node apps run natively on Windows for fast iteration; only stateful services in Docker to save RAM. |
| **Testing** | Vitest, Supertest, k6 | Unit + API + load. Eval harness separate from unit tests. |

**Explicitly out for MVP:** MongoDB, Qdrant / Pinecone / Weaviate, Kubernetes (manifests only in wk 11-12), full billing (stub only).

> RAM budget (~8GB Windows 11): Postgres (~400MB) + Redis (~100MB) + server (~300MB) + worker (~400MB) + dashboard (~400MB) + browser + Docker overhead ≈ fits. Adding Qdrant/Mongo would push +800MB-1GB.

---

## Architecture

```
┌──────────────────────┐
│  Next.js Dashboard   │  chat, docs, agents, usage, evals
│  Tailwind + motion   │
└──────────┬───────────┘
           │ REST / SSE  Authorization: Bearer JWT or x-api-key
           ▼
┌─────────────────────────────────────────────┐
│  Express 5 API (/v1/*)                      │
│  helmet, cors, pino, zod, rate-limit        │
│                                             │
│  ┌────────────┐  ┌────────────────────────┐ │
│  │ Workspaces │  │ Ingest controller      │ │
│  │ RBAC       │  │ POST /ingest -> BullMQ │ │
│  │ ApiKeys    │  └────────────────────────┘ │
│  │ Quotas     │  ┌────────────────────────┐ │
│  └────────────┘  │ Query (hybrid search)  │ │
│                  │ tsvector + pgvector    │ │
│                  │ + rerank + citations   │ │
│                  │ + semantic cache       │ │
│                  └────────────────────────┘ │
│                  ┌────────────────────────┐ │
│                  │ Agent runtime          │ │
│                  │ LangGraph + approvals  │ │
│                  │ + audit log            │ │
│                  └────────────────────────┘ │
│  Memory service │ Eval harness │ Usage/cost  │
└──────┬──────────────────┬───────────────────┘
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ Postgres 18  │   │ Redis +      │
│ + pgvector   │   │ BullMQ       │
│ Prisma       │   │ cache/queue  │
└──────────────┘   └──────────────┘
       ▲
       │ embed / search
       ▼
┌────────────────────────────────┐
│ LLM providers + Tavily         │
│ Gemini Flash / Groq / Mistral  │
└────────────────────────────────┘
```

**Request lifecycle (query example):**

1. Client sends `POST /v1/query` with JWT or API key.
2. `auth` middleware resolves `workspaceId + userId + scopes`. `quota` middleware checks Redis counters.
3. `semantic-cache` lookup: normalized query embedding cosine > 0.97 → cache hit, return + log `cached:true` trace.
4. Else hybrid retrieval: Postgres query filters `workspaceId`, combines `ts_rank` + `embedding <-> $1`, topK*3 → optional rerank → topK.
5. Prompt builder injects: system guardrails + retrieved chunks (with IDs) + relevant memories.
6. LLM call (LangChain) with token counting. Answer parser extracts citations, enforces “no citation = refuse / hedge”.
7. `Trace` + `Usage` rows written, semantic cache set, SSE stream flushed.
8. Response: `{ answer, citations[{documentId, chunkId, snippet, score}], usage{tokens, costUsd, latencyMs} }`.

**Ingestion lifecycle:**

```
POST /v1/ingest {type, ref} -> jobId (BullMQ)
worker: fetch -> parse (pdf/md/html/code) -> clean -> PII-redact
      -> chunk (~800 tokens, 120 overlap, code-aware splitter for github)
      -> embed (batch) -> pgvector upsert -> Document.status=ready
GET /v1/jobs/:id -> { status, progress, error }
```

GitHub re-index uses blob SHA to skip unchanged files; deleted files tombstone their chunks.

---

## Repository Structure

Monorepo (planned — currently bootstrapping):

```
Atlas/
├── docker-compose.yml        # pgvector (pg18) + redis only
├── README.md
├── server/                   # Express 5 API
│   ├── src/
│   │   ├── routes/v1/        # workspaces, ingest, query, agent, usage, traces, evals
│   │   ├── middleware/       # auth, rbac, rateLimit, quota, validate(zod)
│   │   ├── services/         # retrieval, memory, llm, cache, cost
│   │   ├── agent/            # LangGraph graph, tools, approvals
│   │   ├── lib/              # prisma, redis, logger(pino), config
│   │   └── index.ts
│   ├── prisma/schema.prisma
│   └── tests/
├── worker/                   # BullMQ ingestion workers
│   └── src/
│       ├── processors/       # file, url, github
│       ├── chunk.ts
│       ├── embed.ts
│       └── index.ts
├── dashboard/                # Next.js 16 app
│   └── app/
│       ├── (chat)/           # cited Q&A + streaming
│       ├── docs/             # upload + job status
│       ├── agents/           # run timeline + approvals
│       └── usage/            # cost/traces/evals charts
├── evals/
│   ├── datasets/golden.jsonl # {q, expected, mustCite[]}
│   └── run.ts                # nightly harness
└── k6/
    └── load.js               # rps/latency smoke
```

Run Node services natively (`npm run dev`) on Windows; only Postgres + Redis in Docker. This keeps hot-reload fast and RAM low.

---

## Core Data Models (Prisma)

```prisma
model Workspace {
  id        String     @id @default(cuid())
  name      String
  members   Member[]
  apiKeys   ApiKey[]
  documents Document[]
  chunks    Chunk[]
  traces    Trace[]
  memories  Memory[]
  evalRuns  EvalRun[]
  createdAt DateTime   @default(now())
}

model Member {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        Role     // OWNER | EDITOR | VIEWER
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@unique([workspaceId, userId])
}

model ApiKey {
  id          String    @id @default(cuid())
  workspaceId String
  name        String
  keyHash     String    @unique // sha256, never store raw
  keyPrefix   String    // e.g. "ak_8f3a" for identification
  scopes      String[]  // ["query","ingest","agent"]
  quotaMonthly Int?
  expiresAt   DateTime?
  revokedAt   DateTime?
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model Document {
  id          String   @id @default(cuid())
  workspaceId String
  source      Source   // FILE | URL | GITHUB
  ref         String   // path / url / repo@branch:path
  status      DocStatus // PENDING | PROCESSING | READY | FAILED
  hash        String?  // for diff re-index
  error       String?
  chunks      Chunk[]
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model Chunk {
  id          String   @id @default(cuid())
  workspaceId String
  documentId  String
  content     String
  tokens      Int
  // pgvector: `embedding vector(768|1536)` via raw SQL migration
  // + tsvector column for hybrid search
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  @@index([workspaceId])
  @@index([documentId])
}

model Trace {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String?
  kind        String   // query | agent_step | eval
  model       String
  promptTokens Int
  completionTokens Int
  costUsd     Float
  latencyMs   Int
  toolCalls   Json?
  retrievalIds String[]
  cached      Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model Memory {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String?
  fact        String
  confidence  Float    // 0..1
  version     Int      @default(1)
  createdAt   DateTime @default(now())
}

model EvalRun {
  id        String   @id @default(cuid())
  workspaceId String?
  dataset   String   // "golden-v1"
  score     Float    // aggregate 0..1
  metrics   Json     // {faithfulness, citationF1, refusalAcc, p95Ms, costPerQuery}
  createdAt DateTime @default(now())
}
```

Key constraints:
- All retrieval queries **must** filter `workspaceId` — enforced in service layer + Prisma middleware, covered by tests.
- `ApiKey.keyHash` is SHA-256 of random 32-byte secret; only prefix is reversible for lookup UX.
- `Chunk.embedding` uses `pgvector` raw migration (`CREATE EXTENSION vector;`) since Prisma has no native vector type yet. Dimension pinned per embedding model (e.g. 768) — changing models requires re-embed migration.

---

## Core APIs

Base: `/v1`. Auth: `Authorization: Bearer <JWT>` (dashboard users) or `x-api-key: <key>` (programmatic). All responses are JSON unless SSE.

### Workspaces & Members

```http
POST /v1/workspaces
{ "name": "platform-team" }
→ 201 { "id": "ws_...", "name": "platform-team" }

POST /v1/workspaces/:id/members
{ "userId": "u_...", "role": "editor" }
→ 201 { "ok": true }
```

### Ingestion

```http
POST /v1/ingest
Authorization: Bearer ...
{ "type": "file", "ref": "s3://tmp/upload.pdf" }
{ "type": "url", "ref": "https://docs.example.com/guide" }
{ "type": "github", "ref": "org/repo@main:docs/" }

→ 202 { "jobId": "bullmq-id", "documentId": "doc_..." }

GET /v1/jobs/:id
→ 200 { "status": "processing", "progress": 0.6, "error": null }
→ 200 { "status": "done", "documentId": "doc_...", "chunks": 42 }
```

Validation (zod): `type` enum, `ref` non-empty + URL/repo format check, workspace quota pre-check → `429` with `Retry-After` if exceeded.

### Query (RAG)

```http
POST /v1/query
{
  "q": "How do we rotate API keys?",
  "topK": 6,
  "filters": { "source": "GITHUB" }
}

→ 200 {
  "answer": "Rotate via Dashboard > Settings... [1][2]",
  "citations": [
    { "documentId": "doc_...", "chunkId": "ch_...", "snippet": "...", "score": 0.87, "ref": "org/repo@main:docs/auth.md#L12-30" }
  ],
  "usage": { "tokens": 1820, "costUsd": 0.0018, "latencyMs": 940, "cached": false },
  "traceId": "tr_..."
}
```

Errors: `403` if no `query` scope / cross-workspace access, `429` quota, `422` zod validation.

### Agent

```http
POST /v1/agent/run
{
  "goal": "Summarize open auth issues and draft a fix plan",
  "toolsAllowed": ["knowledge.search", "github.createIssue", "web.search"],
  "maxSteps": 12
}
→ 202 { "runId": "run_...", "status": "awaiting_approval", "approvals": [{ "id": "ap_...", "tool": "github.createIssue", "args": {...} }] }

POST /v1/agent/runs/:runId/approve
{ "approvalId": "ap_...", "decision": "approve" }
→ 200 { "status": "running" }

GET /v1/agent/runs/:runId
→ 200 { "status": "done", "steps": [...], "auditLog": [...], "usage": {...} }
```

Side-effect tools never execute without an `approve` record from `owner/editor`. `viewer` can run read-only agents.

### Observability

```http
GET /v1/usage?from=2026-08-01&to=2026-09-09&groupBy=day
→ 200 { "rows": [{ "day": "2026-09-08", "tokens": 41200, "costUsd": 0.042, "queries": 61 }] }

GET /v1/traces?limit=20&kind=query
→ 200 { "traces": [{ "id": "tr_...", "model": "gemini-2.0-flash", ... }] }

GET /v1/evals?limit=10
→ 200 { "runs": [{ "id": "ev_...", "score": 0.84, "metrics": {...} }] }
```

Full OpenAPI / zod schemas live in `server/src/routes/v1/*.ts` (source of truth). Dashboard uses generated fetchers.

---

## RBAC, Auth & Security

| Capability | Owner | Editor | Viewer | API key (scoped) |
|---|---|---|---|---|
| Manage members / keys | ✅ | ❌ | ❌ | ❌ |
| Ingest / delete docs | ✅ | ✅ | ❌ | only with `ingest` scope |
| Query | ✅ | ✅ | ✅ | only with `query` scope |
| Run read-only agent | ✅ | ✅ | ✅ | only with `agent` scope |
| Approve risky tools | ✅ | ✅ | ❌ | ❌ (human JWT only) |
| View usage/traces/evals | ✅ | ✅ | ✅ (own) | ❌ |

Hardening:
- `helmet`, `cors` allow-list, `express-rate-limit` + Redis quota counters.
- `zod` validation on every input; file type + size limits; HTML sanitization on URL ingest.
- JWT short-lived (15m) + refresh rotation; API keys hashed with SHA-256 + prefix lookup.
- PII redaction (regex + LLM pass for emails/secrets) before embedding; prompt-injection classifier flags `ignore previous instructions`-style chunks and downranks them.
- Audit log is append-only — no `UPDATE/DELETE` route exposes it.

---

## AI Pipelines in Detail

### 1. Ingestion Pipeline

1. **Fetch:** file buffer / URL HTML (Tavily extract) / GitHub tarball via API.
2. **Parse:** `pdf-parse` / markdown / `cheerio` readability / code files kept with path + line numbers.
3. **Clean:** normalize whitespace, strip nav/boilerplate, detect language.
4. **PII-redact:** emails, phones, `sk-...`, `x-api-key`, JWTs → `[REDACTED:<type>]`. Original never embedded.
5. **Chunk:** ~800 tokens, 120 overlap. Markdown header-aware; code splitter respects functions (tree-sitter-lite heuristic). Each chunk stores `ref` span for citations.
6. **Embed:** batched (64/chunk batch) via Gemini embeddings (768d) — swappable. Cost logged per batch.
7. **Upsert:** Prisma `$executeRaw` with `embedding` vector + `to_tsvector` in one transaction. Update `Document.status`.

Failure handling: per-file try/catch, `retry: 3` with backoff in BullMQ, `Document.error` surfaced via `GET /jobs/:id`.

### 2. Query / RAG Pipeline

1. Normalize query (lowercase, trim) → check Redis semantic cache (embedding cosine ≥ 0.97, same workspace + filters).
2. Hybrid SQL: `WHERE workspaceId = $1` + `(ts_rank + (1 - (embedding <-> $2)) * weight)` → `LIMIT topK*3`.
3. Optional rerank (Cohere / local cross-encoder — behind flag, off by default to save RAM).
4. Build grounded prompt: “Answer ONLY from context. Cite [n] per claim. If insufficient, say so.”
5. LLM call with timeout + fallback chain: `gemini-2.0-flash → groq-llama-3.3-70b → mistral-small`.
6. Post-check: citation coverage ≥ 1 per 2 sentences else trigger repair call or refusal. Injection-flagged chunks require 2+ corroborating sources.
7. Write `Trace`, update `Usage`, set cache (TTL 24h), return.

Target: p95 < 2s (cached < 200ms), citation precision ≥ 0.8 on golden set.

### 3. Agent Runtime

LangGraph 1.4 state machine:

```
planner → retriever → actor → verifier ─┬─> done
              ▲            │             │
              └──── approver (if risky) ─┘
```

- **State:** `{ goal, plan[], context[], steps[], approvals[], usage }` persisted per step for resume.
- **Tools:** `knowledge.search` (Atlas retrieval), `web.search` (Tavily), `github.*`, `docs.*` — allow-listed per call via `toolsAllowed`.
- **Approvals:** actor emits `approvalRequest` for write/external tools → run pauses (`awaiting_approval`) → dashboard approves/rejects → graph resumes. Timeout auto-rejects after 24h.
- **Verifier:** LLM critic checks plan completion + citation grounding before `done`. Failed verification loops back (max `maxSteps`).
- Every transition writes audit entries queryable via `GET /agent/runs/:id`.

### 4. Memory Service

- Extractor runs on `query` traces rated helpful (thumbs-up) or `agent` runs marked done: LLM proposes `fact` + `confidence`.
- Confidence < 0.6 discarded; ≥ 0.6 stored versioned. User edits bump `version`.
- Retrieval injects top-3 memories (confidence ≥ 0.7) into system prompt with `[memory]` tag.
- `DELETE /memories/:id` for GDPR-style removal; workspace wipe cascades.

### 5. Eval Harness

- Dataset: `evals/datasets/golden.jsonl` — ~50 curated Q&A with `mustCite` doc IDs + refusal cases + adversarial injection cases.
- Nightly (or `npm run eval`): runs all queries against pinned code + data snapshot, scores:
  - `faithfulness` (LLM judge: claims supported?)
  - `citationF1` (predicted vs gold doc IDs)
  - `refusalAcc` (correctly refused unanswerable?)
  - `p95Ms`, `costPerQuery`
- `EvalRun` row + dashboard badge. CI fails if `score` drops > 0.05 vs rolling average.

---

## Observability: Traces, Usage & Cost

- **Trace:** one row per LLM/embedding/tool call. Includes model, tokens, `costUsd` (per-model price table in `server/src/services/cost.ts`), latency, retrieval IDs, `cached` flag.
- **Usage:** aggregated view (`GET /v1/usage`) by day / model / user for billing stub and quota enforcement.
- **Logs:** `pino` JSON logs with `requestId`, `workspaceId`, `traceId` correlation. Pretty-printed in dev.
- **Dashboards:** cost-over-time, top queries, cache hit rate, eval trend — all from existing tables, no extra APM needed for MVP.

Pricing is config-driven so switching `gemini-flash → groq` instantly reflects in cost math.

---

## Getting Started

### Prerequisites

- Node 24+, npm 10+
- Docker Desktop (Windows 11) + WSL2 backend
- Git
- API keys: Google AI (`GOOGLE_API_KEY`), Tavily (`TAVILY_API_KEY`) — Groq/Mistral optional

Verify:

```bash
node -v   # v24.x
docker -v # 24+
```

### 1. Clone & install

```bash
# E:/Main Projects/OnGoing/Atlas
git clone <repo-url> .
# when bootstrapped:
# npm install --workspaces  (or per-package below)
```

### 2. Start stateful services only

```bash
docker compose up -d          # pgvector (pg18) + redis
docker compose ps             # both healthy
```

`docker-compose.yml` exposes `5432` (pg) and `6379` (redis) to host. Node apps run on host for speed.

### 3. Configure env

```bash
cp server/.env.example server/.env
cp worker/.env.example worker/.env
cp dashboard/.env.example dashboard/.env
```

See [Configuration](#configuration-env-vars) for full table.

### 4. Migrate + run

```bash
cd server && npm install && npx prisma migrate dev && npm run dev
# new terminal:
cd ../worker && npm install && npm run dev
# new terminal:
cd ../dashboard && npm install && npm run dev
```

Open:
- API health: `http://localhost:4000/health`
- Dashboard: `http://localhost:3000`
- Prisma Studio: `npx prisma studio` (in `server/`)

### 5. Smoke test (once code exists)

```bash
# create workspace
curl -X POST localhost:4000/v1/workspaces -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -d "{\"name\":\"demo\"}"

# ingest a URL
curl -X POST localhost:4000/v1/ingest -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -d "{\"type\":\"url\",\"ref\":\"https://example.com\"}"

# query (after job done)
curl -X POST localhost:4000/v1/query -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -d "{\"q\":\"What is this about?\",\"topK\":5}"
```

---

## Configuration (Env Vars)

| Var | Where | Required | Example / Notes |
|---|---|---|---|
| `DATABASE_URL` | server, worker | ✅ | `postgresql://atlas:atlas@localhost:5432/atlas?schema=public` |
| `REDIS_URL` | server, worker | ✅ | `redis://localhost:6379` |
| `JWT_SECRET` | server | ✅ | 32+ random bytes, `openssl rand -hex 32` |
| `GOOGLE_API_KEY` | server, worker | ✅ | Default LLM + embeddings |
| `TAVILY_API_KEY` | server, worker | ✅ | Web search + URL extract |
| `GROQ_API_KEY` | server | ⬜ | Cheap fallback LLM |
| `MISTRAL_API_KEY` | server | ⬜ | Alt fallback |
| `PORT` | server | ⬜ | Default `4000` |
| `LOG_LEVEL` | server, worker | ⬜ | `debug` dev / `info` prod |
| `EMBEDDING_DIM` | worker | ⬜ | `768`, must match migration |
| `RERANK_ENABLED` | server | ⬜ | `false` for MVP |
| `NEXT_PUBLIC_API_URL` | dashboard | ✅ | `http://localhost:4000` |

Never commit `.env`. `.env.example` files are the contract.

---

## Development Workflow

```bash
# server
npm run dev        # tsx watch + pino-pretty
npm run build && npm start
npm run lint && npm run typecheck
npx prisma migrate dev --name <change>
npx prisma studio

# worker
npm run dev        # BullMQ + board at :3001 (dev only)

# dashboard
npm run dev        # next dev --turbo
npm run build
```

Conventions:
- ESM only (`"type": "module"`), `.js` import suffixes in TS.
- `zod` schemas co-located with routes; shared types in `server/src/schemas/`.
- Prisma migrations are the only way to change DB — no ad-hoc SQL in prod.
- Every new tool / route needs: zod schema + RBAC check + trace write + test.
- Commits: `feat(server): ...`, `fix(worker): ...`, `docs: ...`.

---

## Testing, Evals & Load Tests

```bash
# unit + API (server)
npm run test              # vitest
npm run test:api          # supertest against ephemeral pg

# eval harness (quality gate)
npm run eval              # runs golden.jsonl, writes EvalRun

# load (k6, needs API running)
k6 run k6/load.js         # 50 VUs, p95 + error-rate thresholds
```

What’s covered:
- Auth/RBAC matrix (viewer cannot ingest/approve; cross-workspace 403).
- Retrieval isolation (workspace A chunks never leak to B).
- Citation enforcement (no naked claims).
- Approval gate (risky tool pauses without human JWT).
- Quota/rate-limit (`429` shape).
- k6 thresholds: `p(95) < 2000ms`, `error_rate < 1%` at 20 RPS query mix.

---

## Roadmap (12 Weeks)

- **Wk 1–2: Auth + workspaces + 1 file ingest → query works**
  Deliver: JWT + workspace CRUD + `ingest(file)` worker + `query` hybrid search + 1 cited answer in dashboard.
  Exit: upload 1 PDF → ask → get cited answer + trace row.

- **Wk 3–4: GitHub / URL connectors, diff re-index, quotas / rate-limit**
  Deliver: `github` + `url` processors, SHA diff skip, Redis quotas + `429`s, `GET /usage`.
  Exit: index a repo, push a commit, re-ingest skips unchanged files; quota blocks over-limit key.

- **Wk 5–6: Agent loop from Mira + approval + audit**
  Deliver: LangGraph graph, 4+ tools, approval pause/resume, `GET /agent/runs/:id` audit view.
  Exit: “open a GitHub issue for X” pauses → approve in UI → issue created + audit shows every step.

- **Wk 7–8: Memory + semantic cache + streaming UI**
  Deliver: memory extractor + injection, Redis semantic cache (hit-rate chart), SSE streaming chat.
  Exit: repeated question returns cached in <200ms; helpful answer becomes reusable memory.

- **Wk 9–10: Nightly evals + PII / injection filters**
  Deliver: golden dataset (50+), nightly `EvalRun`, PII redactor, injection flagger + refusal tests.
  Exit: eval dashboard green; PII never embedded (test proves it); injection demo correctly refused.

- **Wk 11–12: Billing stub, k8s manifests, k6 test, demo gif**
  Deliver: quota → price math + invoice stub, `k8s/` manifests, k6 thresholds passing, polished README + 60s demo.
  Exit: public demo: 1 workspace, 1 doc, 1 cited answer + 1 approval-gated action, cost visible.

---

## Done = MVP Success Criteria

> One workspace, one doc, one cited answer + one approval-gated agent action, with cost visible. Then scale.

Checklist:
- [ ] Create workspace + invite viewer (RBAC enforced, tested)
- [ ] Ingest 1 doc (job `done`, chunks in pgvector)
- [ ] Query returns answer with ≥1 valid citation
- [ ] Agent run pauses for approval → approve → side effect happens + audit log complete
- [ ] `GET /usage` shows tokens + USD for above
- [ ] `npm run eval` passes + k6 p95 < 2s
- [ ] Dashboard demo runs end-to-end on fresh `docker compose up`

---

## Troubleshooting & FAQ

**`docker compose up` fails on Windows?**
Ensure Docker Desktop WSL2 backend is on. Run PowerShell as admin once: `wsl --update`. Prune stale volumes only if you can lose data: `docker compose down -v`.

**Prisma `P1001: Can't reach database`?**
PG container not ready or `DATABASE_URL` host wrong. Use `localhost:5432` when Node runs on host (not `db:5432` — that hostname only works inside Docker network). Wait 5s after `up -d`, then `npx prisma migrate dev`.

**BullMQ jobs stuck in `waiting`?**
Worker not running or `REDIS_URL` mismatch. Start `worker` in a second terminal and confirm same Redis DB. Check Bull Board / `GET /jobs/:id`.

**`401/403` on every call?**
JWT expired (15m) — refresh. API key path needs `x-api-key` header (not `Authorization`) + correct workspace + non-revoked + `scopes` including the route.

**Embeddings dimension mismatch?**
You changed provider without migrating. `EMBEDDING_DIM` must match the `vector(N)` column. Re-embed path: new migration → truncate chunks → re-run ingest.

**Out of RAM (8GB)?**
Only `pg + redis` in Docker — never add Qdrant/Mongo locally. Close Prisma Studio + extra browser tabs during `worker` backfills. Lower embed batch to 16.

**Why not Qdrant?**
pgvector recall is fine to ~1M chunks and saves a whole container. If evals show recall/latency regression at scale, add Qdrant as a sidecar behind the same `retrieval` interface — no API change.

---

## Contributing

PRs welcome. Keep it lean:

1. Fork → branch (`feat/<scope>-<short>`).
2. Add/adjust zod schema + Prisma migration + tests + trace coverage.
3. `npm run lint && npm run typecheck && npm run test` green.
4. Update this README + `evals/datasets/golden.jsonl` if behavior changes.
5. Open PR with what/why, cost impact, and demo (screenshot or trace ID).

No secrets in PRs. No direct pushes to `main`.

---

## License & Author

MIT (planned — add `LICENSE` before public release).

Built and maintained by **Keshav (Keshavcodes3)** — backend-first GenAI engineer. Atlas is the portfolio centerpiece: workspaces, hybrid RAG, permissioned agents, and evals in one lean, production-minded backend.
