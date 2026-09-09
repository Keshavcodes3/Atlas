# Atlas — Team Knowledge + Action Engine

> A backend-heavy learning project for building RAG, agents, background jobs, RBAC, observability, and distributed-system fundamentals with TypeScript.


Atlas is a team knowledge platform where users can connect documents, URLs, and codebases, ask questions about them, and eventually let an AI agent take actions based on that knowledge.

The goal of Atlas **isn't** to immediately build a production SaaS.

The goal is to **learn how the pieces of a production backend fit together by actually building them.**

Think of Atlas as:

```text
Notion-like knowledge → RAG → Agents → Background jobs → Permissions → Observability
```

---

## 📑 Table of Contents

- [Why Atlas?](#-why-atlas)
- [Learning Goals](#-learning-goals)
- [Core Idea](#-core-idea)
- [Features](#-features)
- [Architecture](#-architecture)
- [Repository Structure](#-repository-structure)
- [Core Data Model](#-core-data-model)
- [Core APIs](#-core-apis)
- [AI Pipeline](#-ai-pipeline)
- [Observability, Caching & Jobs](#-observability-caching--jobs)
- [Security](#-security)
- [Technology Stack](#-technology-stack)
- [What Is Explicitly NOT Built Initially?](#-what-is-explicitly-not-built-initially)
- [Development Roadmap](#-development-roadmap)
- [MVP Definition](#-mvp-definition)
- [Testing Strategy](#-testing-strategy)
- [Local Development](#-local-development)
- [Engineering Principles](#-engineering-principles)
- [What I Expect to Learn](#-what-i-expect-to-learn-from-atlas)
- [Status & License](#-status--license)

---

## 💡 Why Atlas?

A basic RAG application looks like:

```mermaid
flowchart TD
    A[Document] --> B[Chunk]
    B --> C[Embedding]
    C --> D[(Vector Database)]
    D --> E[LLM]
    E --> F[Answer]
```

That's useful for learning retrieval.

But real applications introduce much harder problems:

> Who is allowed to access this document?
> What happens when 10,000 documents need to be processed?
> What happens if embedding fails halfway through?
> How do we retry background jobs?
> How does an agent use tools safely?
> How do we pause an agent and wait for a human?
> How do we know what the model did?
> How much did a request cost?
> How do we test whether our RAG system is actually getting better?

Atlas gradually introduces these problems — one vertical slice at a time.

---

## 🎯 Learning Goals

By building Atlas, the main goal is to understand:

| Area | Topics |
|------|--------|
| **Backend** | Express architecture, TypeScript backend design, PostgreSQL, Prisma, transactions, indexing, pagination, authentication, RBAC, API design, validation, error handling, background jobs, Redis, queues, caching, concurrency, graceful shutdown, observability |
| **Distributed Systems** | Asynchronous processing, producer/consumer systems, retries, exponential backoff, idempotency, job state machines, failure recovery, rate limiting, eventual consistency, cache invalidation, distributed locks |
| **GenAI** | Embeddings, vector search, chunking, retrieval, hybrid search, reranking, prompt construction, citations, tool calling, agent loops, memory, evaluation |

---

## 🧠 Core Idea

### 1. A user creates a workspace

```text
Workspace
   │
   ├── Members
   ├── Documents
   ├── API Keys
   ├── Agent Runs
   └── Knowledge
```

### 2. They add knowledge

```mermaid
flowchart TD
    subgraph Sources
        PDF
        MD[Markdown]
        URL
        GH[GitHub repo]
    end
    Sources --> ING[Ingestion]
    ING --> CH[Chunks]
    CH --> EMB[Embeddings]
    EMB --> PG[(PostgreSQL + pgvector)]
```

### 3. Then they can ask

```text
"How does authentication work in this project?"
```

Atlas retrieves relevant knowledge and generates an answer **with citations**.

### 4. Later, they delegate

```text
"Find the authentication issues and create a GitHub issue for each one."
```

The agent can:

```mermaid
flowchart TD
    A[Understand goal] --> B[Search knowledge]
    B --> C[Analyze results]
    C --> D[Plan action]
    D --> E[Request approval]
    E --> F[Execute tool]
    F --> G[Verify result]
```

---

## ✨ Features

### 1. Workspaces

Users can create workspaces and collaborate with other users.

Each workspace contains its own:

- `documents`
- `members`
- `api keys`
- `agent runs`
- `traces`
- `usage information`

Example:

```text
Acme Engineering
│
├── Alice    OWNER
├── Bob      EDITOR
└── Charlie  VIEWER
```

---

### 2. Authentication

Atlas supports:

- ✅ **JWT authentication** for users
- ✅ **API keys** for programmatic access

Basic flow:

```mermaid
flowchart TD
    Req[Request] --> Auth[Authentication]
    Auth --> User[Identify user]
    User --> WS[Identify workspace]
    WS --> Perm[Check permissions]
    Perm --> Exec[Execute request]
```

---

### 3. RBAC

The initial roles are:

| Permission         | Owner | Editor | Viewer |
|--------------------|-------|--------|--------|
| View workspace     | ✓     | ✓      | ✓      |
| Query knowledge    | ✓     | ✓      | ✓      |
| Upload documents   | ✓     | ✓      | ✗      |
| Delete documents   | ✓     | ✓      | ✗      |
| Manage members     | ✓     | ✗      | ✗      |
| Run agents         | ✓     | ✓      | ✓      |
| Approve actions    | ✓     | ✓      | ✗      |

> The important learning goal is not the number of roles.
> It's understanding that **authorization must happen before business logic executes.**

---

### 4. Document Ingestion

Atlas initially supports:

- `Markdown` · `TXT` · `PDF` · `URLs` · `GitHub repositories`

The ingestion pipeline is **asynchronous**:

```mermaid
flowchart TD
    API[POST /v1/ingest] --> Q[(Queue)]
    Q --> W[Worker]
    W --> F[Fetch]
    F --> P[Parse]
    P --> C[Clean]
    C --> CH[Chunk]
    CH --> E[Embed]
    E --> S[(Store)]
```

The API does not sit around waiting for a large PDF or repository to finish processing. It returns a job:

```json
{
  "jobId": "job_123",
  "status": "queued"
}
```

The client can later check:

```http
GET /v1/jobs/job_123
```

---

### 5. RAG

Atlas uses **PostgreSQL + pgvector** for the initial implementation.

```mermaid
flowchart TD
    Q[User Query] --> QE[Query Embedding]
    QE --> VS[Vector Search]
    VS --> RC[Relevant Chunks]
    RC --> PC[Prompt Construction]
    PC --> LLM[LLM]
    LLM --> AC[Answer + Citations]
```

A retrieved chunk might look like:

```json
{
  "id": "chunk_123",
  "documentId": "doc_42",
  "content": "Authentication middleware validates...",
  "score": 0.87
}
```

The final response contains citations:

```json
{
  "answer": "Authentication is handled by the auth middleware...",
  "citations": [
    {
      "documentId": "doc_42",
      "chunkId": "chunk_123"
    }
  ]
}
```

---

### 6. Hybrid Search

Vector search isn't always enough. For example:

```text
"Postgres P1001"
```

Keyword search can be extremely useful. Atlas therefore eventually combines:

```mermaid
flowchart TD
    Q[Query] --> V[Vector Search]
    Q --> K[Keyword Search]
    V --> M[Merge Candidates]
    K --> M
    M --> R[Optional Reranking]
    R --> T[Top K]
```

> The first implementation can simply use vector search.
> Hybrid retrieval is introduced later as a learning milestone.

---

### 7. Agent Runtime

Once RAG works, Atlas introduces agents. An agent receives a goal:

```text
"Find open authentication issues and create a GitHub issue containing a summary."
```

The agent can use tools such as:

```text
knowledge.search
github.searchIssues
github.createIssue
web.search
```

A simplified agent loop:

```mermaid
flowchart TD
    P[Planner] --> R[Retriever]
    R --> A[Agent]
    A --> T[Tool]
    T --> V[Verifier]
    V -->|done| D[Done]
    V -->|retry| P
```

The first version does not need a sophisticated autonomous system. The goal is to understand:

```text
state · transitions · tool calling · retries · stopping conditions · failures
```

---

### 8. Human Approval

Agents should not automatically perform dangerous actions. For example:

```text
github.createIssue
github.deleteBranch
docs.update
```

…can require approval.

```mermaid
flowchart TD
    A[Agent] --> T[Tool requested]
    T --> Q{Is tool dangerous?}
    Q -->|No| E[Execute]
    Q -->|Yes| W[Await approval]
    W --> H[Human approves]
    H --> E2[Execute]
    E2 --> V[Verify]
```

> An agent is not just an LLM. It is a **state machine around an LLM.**

---

### 9. Memory

Atlas can store useful facts learned during conversations. Example:

```json
{
  "fact": "The platform team uses PostgreSQL for primary storage.",
  "confidence": 0.91
}
```

Memory can later be injected into agent or query context. Initial memory implementation will be intentionally simple. The goal is to learn:

```text
memory extraction · memory retrieval · confidence · versioning · deletion · context injection
```

---

### 10. Observability

Every important operation should leave evidence.

```mermaid
flowchart TD
    Req[Request] --> Tr[Trace]
    Tr --> R[Retrieval]
    Tr --> L[LLM call]
    Tr --> T[Tool call]
    Tr --> D[Database ops]
```

A trace may contain:

```json
{
  "traceId": "trace_123",
  "model": "gemini",
  "promptTokens": 1200,
  "completionTokens": 300,
  "latencyMs": 840,
  "costUsd": 0.0012
}
```

This makes questions like these answerable:

> Why was this request slow?
> Which model was used?
> How many tokens did it consume?
> Which documents were retrieved?
> Which tools did the agent execute?

---

## 🏗 Architecture

Atlas starts as a **modular monolith**. Later, individual components can be separated when there is an actual reason to do so.

```mermaid
flowchart TD
    UI[Next.js UI] -->|REST / SSE| API[Express API]
    subgraph API_MOD [ ]
        API --> AUTH[Auth / RBAC]
        API --> WS[Workspaces]
        API --> DOC[Documents]
        API --> RAG[Query / RAG]
        API --> AG[Agents]
        API --> USE[Usage]
    end
    API --> PG[(PostgreSQL + pgvector)]
    API --> RD[(Redis + BullMQ)]
    RD --> WK[Worker]
    WK --> P[Parse]
    WK --> C[Chunk]
    WK --> E[Embed]
    P --> PG
    C --> PG
    E --> PG
    PG --> LLM[LLM Providers]
```

The important architectural boundary is:

```text
API
 │
 ├── Application Services
 │
 ├── Domain Logic
 │
 └── Infrastructure
       ├── PostgreSQL
       ├── Redis
       ├── LLM
       └── External APIs
```

> The project deliberately avoids microservices initially.

### Request Lifecycle

For a normal RAG request:

```mermaid
flowchart TD
    C[Client] --> Q[POST /v1/query]
    Q --> A[Auth]
    A --> R[RBAC]
    R --> S[Query Service]
    S --> N[Query normalization]
    N --> RC[Retrieve chunks]
    RC --> BC[Build context]
    BC --> L[Call LLM]
    L --> T[Store trace]
    T --> AN[Answer + Citations]
```

### Ingestion Lifecycle

```mermaid
flowchart TD
    C[Client] --> I[POST /v1/ingest]
    I --> D[Create Document]
    D --> J[Create Job]
    J --> R[(Redis / BullMQ)]
    R --> W[Worker]
    W --> F[Fetch → Parse → Clean → Chunk → Embed → Store]
    F --> RDY[Document READY]
```

If something fails:

```mermaid
flowchart TD
    W[Worker] --> E[Error]
    E --> R[Retry]
    R -->|success| D[DONE]
    R -->|failure| F[FAILED]
```

> This is where Atlas starts becoming a backend engineering project rather than just an AI demo.

---

## 📁 Repository Structure

```text
atlas/
│
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   └── v1/
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rbac.ts
│   │   │   └── error.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── workspace/
│   │   │   ├── document/
│   │   │   ├── query/
│   │   │   ├── agent/
│   │   │   └── usage/
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   ├── retrieval/
│   │   │   ├── memory/
│   │   │   └── cost/
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── redis.ts
│   │   │   └── logger.ts
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── tests/
│
├── worker/
│   └── src/
│       ├── processors/
│       │   ├── file.ts
│       │   ├── url.ts
│       │   └── github.ts
│       ├── chunk.ts
│       ├── embed.ts
│       └── index.ts
│
├── dashboard/
│   └── app/
│
├── evals/
│   ├── datasets/
│   └── run.ts
│
├── k6/
│   └── load.js
│
├── docker-compose.yml
└── README.md
```

> The exact structure may change during development.
> Architecture should evolve when the code teaches us that the current structure is no longer appropriate.

---

## 🗄 Core Data Model

The initial database model is intentionally small.

```mermaid
flowchart TD
    U[User] --> M[Member]
    M --> W[Workspace]
    W --> D[Document]
    D --> C[Chunk]
    W --> K[ApiKey]
    W --> A[AgentRun]
    W --> ME[Memory]
    W --> T[Trace]
```

Example Prisma models:

```prisma
model Workspace {
  id        String     @id @default(cuid())
  name      String
  createdAt DateTime   @default(now())

  members   Member[]
  documents Document[]
  apiKeys   ApiKey[]
  traces    Trace[]
  memories  Memory[]
}

model Member {
  id          String    @id @default(cuid())
  workspaceId String
  userId      String
  role        Role

  workspace   Workspace @relation(
    fields: [workspaceId],
    references: [id],
    onDelete: Cascade
  )

  @@unique([workspaceId, userId])
}

model Document {
  id          String     @id @default(cuid())
  workspaceId String
  name        String
  source      String
  status      DocStatus
  createdAt   DateTime   @default(now())

  workspace   Workspace  @relation(
    fields: [workspaceId],
    references: [id],
    onDelete: Cascade
  )

  chunks      Chunk[]

  @@index([workspaceId])
}

model Chunk {
  id          String   @id @default(cuid())
  documentId  String
  workspaceId String
  content     String
  tokens      Int

  document    Document @relation(
    fields: [documentId],
    references: [id],
    onDelete: Cascade
  )

  @@index([workspaceId])
  @@index([documentId])
}
```

> Vector columns will initially be added using a PostgreSQL migration because Prisma's support for vector types requires additional handling.

---

## 🔌 Core APIs

Base URL: `/v1`

### Workspaces

```http
POST /v1/workspaces
```

```json
{
  "name": "Atlas Engineering"
}
```

### Ingestion

```http
POST /v1/ingest
```

```json
{
  "type": "url",
  "ref": "https://example.com/docs"
}
```

Response:

```json
{
  "jobId": "job_123",
  "documentId": "doc_123"
}
```

### Job Status

```http
GET /v1/jobs/:id
```

```json
{
  "status": "processing",
  "progress": 0.6
}
```

Possible states:

```text
queued · processing · completed · failed
```

### Query

```http
POST /v1/query
```

```json
{
  "q": "How does authentication work?"
}
```

Response:

```json
{
  "answer": "Authentication is handled by...",
  "citations": [
    {
      "documentId": "doc_123",
      "chunkId": "chunk_456"
    }
  ]
}
```

### Agent

```http
POST /v1/agent/run
```

```json
{
  "goal": "Find authentication issues"
}
```

Response:

```json
{
  "runId": "run_123",
  "status": "running"
}
```

---

## 🤖 AI Pipeline

### Phase 1: Ingestion

```mermaid
flowchart TD
    S[Source] --> P[Parser]
    P --> C[Cleaner]
    C --> CH[Chunker]
    CH --> E[Embedding Model]
    E --> PG[(PostgreSQL)]
```

#### Chunking

The first implementation will use approximately:

```text
chunk size: ~800 tokens
overlap:    ~100 tokens
```

> These numbers are starting points, not universal truths.
> One of the goals of the project is to experiment with different chunking strategies and evaluate their effect on retrieval.

### Phase 2: Retrieval

Initial implementation:

```mermaid
flowchart TD
    Q[Query] --> E[Embedding]
    E --> V[pgvector]
    V --> K[Top K chunks]
```

Later:

```mermaid
flowchart TD
    Q[Query] --> V[Vector Search]
    Q --> K[Keyword Search]
    V --> M[Merge]
    K --> M
    M --> R[Rerank]
    R --> T[Top K]
```

### Phase 3: Generation

Retrieved chunks become context:

```mermaid
flowchart TD
    S[System Instructions] --> LLM
    U[User Question] --> LLM
    C[Retrieved Context] --> LLM
    M[Relevant Memory] --> LLM
    LLM --> A[Answer]
```

> The model should be instructed to ground its response in the retrieved context.

### Phase 4: Agents

Agents are introduced **only after the RAG pipeline works**. A basic state might look like:

```typescript
type AgentState = {
  goal: string;
  plan: string[];
  context: Chunk[];
  steps: AgentStep[];
  pendingApproval?: Approval;
};
```

> The agent graph manages transitions between states.

### Phase 5: Memory

Memory is deliberately added later.

```mermaid
flowchart TD
    C[Conversation] --> E[Memory Extractor]
    E --> F[Candidate Fact]
    F --> CC[Confidence Check]
    CC --> S[Store]
    S --> R[Retrieve Later]
```

> The first implementation doesn't need sophisticated long-term memory.
> The purpose is to understand the architectural problem.

---

## 🔍 Observability, Caching & Jobs

### Observability

Atlas will track basic telemetry.

**For an LLM request:**

```typescript
type LlmTrace = {
  traceId: string;
  workspaceId: string;
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cost: number;
};
```

**For retrieval:**

```typescript
type RetrievalTrace = {
  query: string;
  retrievedChunkIds: string[];
  scores: number[];
  latency: number;
};
```

**For agents:**

```typescript
type AgentTrace = {
  runId: string;
  step: number;
  tool: string;
  arguments: unknown;
  result: unknown;
  duration: number;
};
```

This creates an execution trail:

```mermaid
flowchart TD
    Req[Request] --> Ret[Retrieval]
    Ret --> L1[LLM]
    L1 --> T[Tool]
    T --> L2[LLM]
    L2 --> Res[Response]
```

### Caching

Redis will eventually be used for:

```text
caching · rate limiting · job queues · temporary state
```

The first cache implementation should be simple:

```mermaid
flowchart TD
    Q[normalized query] --> R[(Redis)]
    R --> H{cache hit?}
    H -->|yes| RET[return]
    H -->|no| RAG[RAG]
    RAG --> RS[(Redis)]
```

> Semantic caching is intentionally a later feature.

### Background Jobs

BullMQ is used to understand asynchronous backend processing.

```mermaid
flowchart TD
    API[API] -->|add job| RD[(Redis)]
    RD --> B[BullMQ]
    B --> W[Worker]
    W --> P[process]
    W --> R[retry]
    W --> C[complete]
```

Important concepts to learn:

```text
job states · retries · exponential backoff · concurrency
· idempotency · dead-letter handling · graceful shutdown
```

### Failure Handling

Failures are expected.

```mermaid
flowchart TD
    E[Embedding API] --> T1[timeout]
    T1 --> R1[retry]
    R1 --> T2[timeout]
    T2 --> R2[retry]
    R2 --> S[success]
```

But some failures should not retry forever. Eventually:

```mermaid
flowchart TD
    F[FAILED] --> E[error stored]
    E --> V[visible to user]
```

> This is one of the main backend-learning parts of Atlas.

---

## 🔒 Security

Atlas will implement basic security practices:

```text
password hashing · JWT authentication · API-key hashing · RBAC
· input validation with Zod · rate limiting · request size limits
· CORS configuration · Helmet · basic prompt-injection handling · workspace isolation
```

The most important invariant is:

> A user must never retrieve data from a workspace they do not have access to.

Conceptually:

```sql
WHERE workspace_id = current_workspace
```

> Every retrieval path must preserve this invariant.

---

## 🧰 Technology Stack

| Area | Technology |
|------|------------|
| Language | `TypeScript` |
| Runtime | `Node.js` |
| API | `Express` |
| Validation | `Zod` |
| Database | `PostgreSQL` |
| ORM | `Prisma` |
| Vector Search | `pgvector` |
| Cache | `Redis` |
| Queue | `BullMQ` |
| AI | `LangChain` |
| Agents | `LangGraph` |
| Web Search | `Tavily` |
| Frontend | `Next.js` |
| Styling | `Tailwind CSS` |
| Testing | `Vitest + Supertest` |
| Load Testing | `k6` |
| Local Infra | `Docker Compose` |

### Why this stack?

> The goal isn't to use every popular tool.
> The goal is to learn how a relatively small set of technologies can solve increasingly complex problems.

---

## 🚫 What Is Explicitly NOT Built Initially?

Atlas is intentionally **not** starting with:

```text
Kubernetes · microservices · Qdrant · Kafka · complex billing
· multi-region deployment · distributed tracing infrastructure
· sophisticated semantic caching · custom LLM hosting
· complex event sourcing · elaborate CI/CD infrastructure
```

Those technologies may become useful later. But adding infrastructure before understanding the underlying problem usually produces **architecture cosplay**.

> Atlas is about learning the *why* before collecting the *what*.

---

## 🗺 Development Roadmap

> The roadmap is progressive rather than deadline-driven.

### Stage 1 — Backend Foundation

Build:

```text
Express server · TypeScript · Zod · PostgreSQL · Prisma
· migrations · error handling · logging · basic REST APIs
```

Goal — understand the request lifecycle:

```mermaid
flowchart TD
    H[HTTP] --> R[Router]
    R --> C[Controller]
    C --> S[Service]
    S --> RE[Repository]
    RE --> D[(Database)]
```

### Stage 2 — Authentication & Workspaces

Build:

```text
users · login · JWT · workspaces · members · roles · RBAC middleware
```

Goal — understand multi-tenant authorization.

Important invariant:

```text
workspace A ≠ workspace B
```

> A request authenticated as a member of A must never accidentally query B.

### Stage 3 — Document System

Build:

```text
document CRUD · file uploads · document status · metadata · deletion · database indexes
```

Goal — become comfortable with PostgreSQL-backed application design.

### Stage 4 — Background Jobs

Introduce:

```text
Redis · BullMQ · workers · retries · job status · concurrency
```

Architecture becomes:

```text
API → Queue → Worker → Database
```

Goal — understand asynchronous processing.

### Stage 5 — RAG

Build:

```text
document parsing · chunking · embeddings · pgvector
· similarity search · prompt construction · citations
```

Goal — build a complete RAG pipeline yourself.

```mermaid
flowchart TD
    D[Document] --> C[Chunk]
    C --> E[Embed]
    E --> S[(Store)]
    Q[Query] --> QE[Embed]
    QE --> R[Retrieve]
    R --> L[LLM]
```

### Stage 6 — Better Retrieval

Add:

```text
metadata filtering · keyword search · hybrid retrieval · reranking experiments · retrieval evaluation
```

Goal — understand why:

```text
"better embeddings"  ≠  "better retrieval"
```

### Stage 7 — Agent Runtime

Introduce `LangGraph`. Build:

```text
agent state · planner · retrieval tool · tool calling
· execution loop · maximum steps · failure handling
```

Goal — understand agents as **stateful systems** rather than magical chatbots.

### Stage 8 — Human Approval

Add:

```text
approval requests · pause/resume · risky-tool classification · approval API · audit records
```

Example:

```mermaid
flowchart TD
    A[Agent] --> T[github.createIssue]
    T --> AR[Approval Required]
    AR --> W[WAITING]
    W --> H[Human approves]
    H --> R[Resume]
    R --> E[Tool executes]
```

Goal — learn how to build systems where autonomous execution still has explicit control boundaries.

### Stage 9 — Memory

Add:

```text
memory extraction · confidence · memory retrieval · editing · deletion · versioning
```

Goal — understand context management beyond a single conversation.

### Stage 10 — Observability

Add:

```text
request IDs · trace IDs · LLM usage · latency
· token tracking · cost calculation · agent traces
```

Goal — answer:

```text
"What exactly happened during this request?"
```

### Stage 11 — Evaluation

Create a small golden dataset:

```json
{
  "question": "How is authentication implemented?",
  "expected": "...",
  "mustContain": ["JWT", "middleware"]
}
```

Evaluate:

```text
retrieval quality · citation correctness · answer quality · latency · cost
```

Goal — learn that AI systems need **measurement, not just demos.**

### Stage 12 — Performance & Scale

Only after the system works:

```text
add indexes · investigate slow queries · load test with k6
· tune worker concurrency · measure Redis performance
· investigate PostgreSQL query plans · optimize embedding batches
· introduce caching
```

Then ask:

> What is actually slow?

Instead of:

> What infrastructure can I add?

---

## ✅ MVP Definition

Atlas is considered a successful learning project when this works end-to-end:

```mermaid
flowchart TD
    A[Create Workspace] --> B[Upload Document]
    B --> C[Background Worker Processes It]
    C --> D[Chunks + Embeddings Stored]
    D --> E[Ask Question]
    E --> F[Relevant Chunks Retrieved]
    F --> G[LLM Generates Answer]
    G --> H[Answer Contains Citations]
    H --> I[Trace Is Recorded]
    I --> J[Agent Uses Knowledge]
    J --> K[Agent Requests Approval]
    K --> L[Human Approves]
    L --> M[Tool Executes]
```

> That is enough.
> Everything after this is optimization, experimentation, and deeper systems engineering.

---

## 🧪 Testing Strategy

Atlas uses several layers of testing.

**Unit Tests** — test individual pieces:

```text
chunker · RBAC rules · cost calculation · query normalization · agent transitions
```

**API Tests** — test:

```text
authentication · authorization · document APIs · query APIs · agent APIs
```

**Integration Tests** — test:

```mermaid
flowchart TD
    API[API] --> PG[(PostgreSQL)]
    PG --> RD[(Redis)]
    RD --> W[Worker]
```

**RAG Evaluation** — test whether retrieval and generated answers are actually useful.

**Load Testing** — use `k6` to understand:

```text
requests/sec · latency · error rate · database pressure · worker throughput
```

---

## 💻 Local Development

Only stateful infrastructure runs in Docker:

```mermaid
flowchart TD
    D[Docker] --> P[(PostgreSQL)]
    D --> R[(Redis)]
```

Node services run directly on the machine.

```bash
docker compose up -d
```

Then:

```bash
cd server
npm install
npm run dev
```

Worker:

```bash
cd worker
npm install
npm run dev
```

Dashboard:

```bash
cd dashboard
npm install
npm run dev
```

> This keeps development relatively lightweight.

### Environment Variables

Example:

```bash
DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas

REDIS_URL=redis://localhost:6379

JWT_SECRET=your-secret

GOOGLE_API_KEY=your-key

TAVILY_API_KEY=your-key

PORT=4000

NEXT_PUBLIC_API_URL=http://localhost:4000
```

> ⚠️ Never commit real secrets.

---

## 🧭 Engineering Principles

### 1. Understand before abstracting

Don't create five interfaces for something that currently has one implementation.

### 2. Measure before optimizing

If PostgreSQL is slow:

```mermaid
flowchart TD
    M[measure] --> E[EXPLAIN ANALYZE]
    E --> I[identify bottleneck]
    I --> O[optimize]
```

Don't immediately add another database.

### 3. Prefer simple architecture first

Start:

```text
Modular Monolith
```

not:

```text
Microservices + Kafka + Kubernetes + 14 dashboards
```

### 4. Make failures explicit

Every asynchronous operation should have a meaningful state.

```text
QUEUED · PROCESSING · COMPLETED · FAILED
```

### 5. Preserve invariants

The most important Atlas invariant:

```text
workspaceId must propagate through every
authorization and retrieval boundary.
```

### 6. Build features in vertical slices

Instead of:

```text
Build entire database
Build entire backend
Build entire AI system
Build frontend
```

Build:

```mermaid
flowchart TD
    A[Create workspace] --> B[API]
    B --> C[Database]
    C --> D[UI]
```

Then:

```mermaid
flowchart TD
    A[Upload document] --> B[Queue]
    B --> C[Worker]
    C --> D[Database]
    D --> E[UI]
```

Then:

```mermaid
flowchart TD
    A[Query] --> B[Retrieval]
    B --> C[LLM]
    C --> D[Citations]
```

> This keeps every stage executable.

---

## 🎓 What I Expect to Learn From Atlas

By the end, I should be able to explain:

**Backend**

```text
How an HTTP request moves through an application.
Where business logic belongs.
How transactions work.
How PostgreSQL indexes affect queries.
How authentication differs from authorization.
How multi-tenancy can fail.
```

**Distributed Systems**

```text
Why background jobs exist.
How queues work.
Why retries can create duplicate work.
What idempotency means.
How rate limiting works.
Why caches are difficult to invalidate.
What eventual consistency looks like in practice.
```

**RAG**

```text
How embeddings represent semantic relationships.
How vector search works.
Why chunking affects retrieval.
Why retrieval quality matters more than simply increasing context.
How citations can be tied back to source chunks.
```

**Agents**

```text
Why an agent is fundamentally a state machine.
How tools are represented.
How execution can be paused.
Why approvals matter.
How agents fail.
```

**Production Thinking**

```text
How to measure latency.
How to track cost.
How to inspect failures.
How to load test.
How to identify bottlenecks.
When infrastructure should actually be introduced.
```

### Final Architecture

The final learning architecture should roughly look like:

```mermaid
flowchart TD
    UI[Next.js Dashboard] -->|HTTP / SSE| API[Express API]
    API --> AUTH[Auth / RBAC]
    API --> WS[Workspaces]
    API --> DOC[Documents]
    API --> RAG[Query / RAG]
    API --> AG[Agents]
    API --> USE[Usage / Traces]
    API --> PG[(PostgreSQL + pgvector)]
    API --> RD[(Redis)]
    RD --> BQ[BullMQ]
    BQ --> WK[Worker]
    WK --> P[Parse]
    WK --> E[Embed]
    P --> PG
    E --> PG
    PG --> LLM[LLM Providers]
```

The architecture is intentionally allowed to evolve.

> If a bottleneck appears, investigate it.
> If a boundary becomes painful, redesign it.
> If a new infrastructure component solves a demonstrated problem, introduce it.

Don't build the architecture you think a 10-million-user company needs.

Build the architecture that teaches you why a 10-million-user company needs it.

---

## 🚧 Status & License

### Status

🚧 **Learning Project / In Development**

Atlas is being built primarily as an engineering learning project. It is not intended to be production-ready software. The architecture, APIs, database schema, and technology choices will evolve as new concepts are learned and tested.

### License

```text
MIT
```
