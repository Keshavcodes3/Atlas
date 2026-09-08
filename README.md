# Atlas — team knowledge + action engine

> One backend where a team connects docs/code/URLs, then queries and acts via agents with permissions. RAG + agents + evals, production-grade.

Built by Keshav (Keshavcodes3). Backend-first, GenAI-powered. Runs lean on 8GB RAM, Windows 11, Docker.

## Why Atlas

Chatbots answer. RAG demos search. Teams need more: who can access what, what did it cost, was it correct, can the agent act safely.

Atlas = mini Notion + RAG + LangGraph + Stripe-style API in one repo. Absorbs `Mira` (agent loop) and `codebase-rag` (retrieval) as modules.

## Stack

- API: Node 24, Express 5 ESM, zod, JWT + API keys, helmet/cors, pino
- DB: Postgres 18 + pgvector + Prisma (relational + vectors in one DB)
- Queue/Cache: Redis + BullMQ (ingestion workers, semantic cache)
- AI: LangChain 1.5, LangGraph 1.4, Google-genai / Groq / Mistral, Tavily search
- Dashboard: Next.js 16, Tailwind, framer-motion
- Infra: Docker Compose (pg + redis only), k6 for load tests

No Mongo, no Qdrant for MVP — saves ~1GB RAM. Add Qdrant later only if evals demand it.

## Architecture

```
Next.js dashboard
  -> Express API (/v1/*)
    -> Workspaces / RBAC / quotas
    -> Ingest workers (upload|url|github -> chunk -> embed -> pgvector)
    -> Query (hybrid tsvector + <-> + citations)
    -> Agent runtime (LangGraph loop + approval + audit log)
    -> Memory service + Eval harness + Usage/cost
```

## Core models (Prisma)

Workspace, Member (owner/editor/viewer), ApiKey (hash, quota), Document (source, status), Chunk (embedding vector), Trace (tokens, cost, tools), Memory (fact, confidence, version), EvalRun (score, dataset).

## Core APIs

```
POST /v1/workspaces
POST /v1/ingest {type: file|url|github, ref} -> {jobId}
GET  /v1/jobs/:id
POST /v1/query {q, topK} -> {answer, citations[]}
POST /v1/agent/run {goal} -> {runId, approvals[]}
GET  /v1/usage, /v1/traces, /v1/evals
```

## Roadmap (12 weeks)

- Wk 1-2: auth + workspaces + 1 file ingest -> query works
- Wk 3-4: github/url connectors, diff re-index, quotas/rate-limit
- Wk 5-6: agent loop from Mira + approval + audit
- Wk 7-8: memory + semantic cache + streaming UI
- Wk 9-10: nightly evals + PII/injection filters
- Wk 11-12: billing stub, k8s manifests, k6 test, demo gif

## Getting started

```bash
# E:/Main Projects/OnGoing/Atlas
docker compose up -d          # pgvector + redis
cd server && npm install && npx prisma migrate dev && npm run dev
cd ../worker && npm run dev
cd ../dashboard && npm run dev
```

Env: `DATABASE_URL`, `REDIS_URL`, `GOOGLE_API_KEY`, `TAVILY_API_KEY`, `JWT_SECRET`.

## Done =

One workspace, one doc, one cited answer + one approval-gated agent action, with cost visible. Then scale.
