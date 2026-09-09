Atlas — Team Knowledge + Action Engine

A backend-heavy learning project for building RAG, agents, background jobs, RBAC, observability, and distributed-system fundamentals with TypeScript.

Atlas is a team knowledge platform where users can connect documents, URLs, and codebases, ask questions about them, and eventually let an AI agent take actions based on that knowledge.

The goal of Atlas isn't to immediately build a production SaaS.

The goal is to learn how the pieces of a production backend fit together by actually building them.

Think of Atlas as:

Notion-like knowledge → RAG → Agents → Background jobs → Permissions → Observability

Why Atlas?

A basic RAG application looks like:

Document
   ↓
Chunk
   ↓
Embedding
   ↓
Vector Database
   ↓
LLM
   ↓
Answer

That's useful for learning retrieval.

But real applications introduce much harder problems:

Who is allowed to access this document?
What happens when 10,000 documents need to be processed?
What happens if embedding fails halfway through?
How do we retry background jobs?
How does an agent use tools safely?
How do we pause an agent and wait for a human?
How do we know what the model did?
How much did a request cost?
How do we test whether our RAG system is actually getting better?

Atlas gradually introduces these problems.

Learning Goals

By building Atlas, the main goal is to understand:

Backend
Express architecture
TypeScript backend design
PostgreSQL
Prisma
transactions
indexing
pagination
authentication
RBAC
API design
validation
error handling
background jobs
Redis
queues
caching
concurrency
graceful shutdown
observability
Distributed Systems
asynchronous processing
producer/consumer systems
retries
exponential backoff
idempotency
job state machines
failure recovery
rate limiting
eventual consistency
cache invalidation
distributed locks
GenAI
embeddings
vector search
chunking
retrieval
hybrid search
reranking
prompt construction
citations
tool calling
agent loops
memory
evaluation
Architecture

The project starts as a modular monolith.

Later, individual components can be separated when there is an actual reason to do so.

Core Idea

A user creates a workspace.

Workspace
   │
   ├── Members
   ├── Documents
   ├── API Keys
   ├── Agent Runs
   └── Knowledge

They add knowledge:

PDF
Markdown
URL
GitHub repository
       │
       ▼
   Ingestion
       │
       ▼
     Chunks
       │
       ▼
   Embeddings
       │
       ▼
   PostgreSQL

Then they can ask:

"How does authentication work in this project?"

Atlas retrieves relevant knowledge and generates an answer with citations.

Later:

"Find the authentication issues and create a GitHub issue for each one."

The agent can:

Understand goal
      ↓
Search knowledge
      ↓
Analyze results
      ↓
Plan action
      ↓
Request approval
      ↓
Execute tool
      ↓
Verify result
Features

1. Workspaces

Users can create workspaces and collaborate with other users.

Each workspace contains its own:

documents
members
API keys
agent runs
traces
usage information

Example:

Acme Engineering
│
├── Alice   OWNER
├── Bob     EDITOR
└── Charlie VIEWER
2. Authentication

Atlas supports:

JWT authentication for users
API keys for programmatic access

Basic flow:

Request
   ↓
Authentication
   ↓
Identify user
   ↓
Identify workspace
   ↓
Check permissions
   ↓
Execute request
3. RBAC

The initial roles are:

Permission Owner Editor Viewer
View workspace ✓ ✓ ✓
Query knowledge ✓ ✓ ✓
Upload documents ✓ ✓ ✗
Delete documents ✓ ✓ ✗
Manage members ✓ ✗ ✗
Run agents ✓ ✓ ✓
Approve actions ✓ ✓ ✗

The important learning goal is not the number of roles.

It's understanding that authorization must happen before business logic executes.

1. Document Ingestion

Atlas initially supports:

Markdown
TXT
PDF
URLs
GitHub repositories

The ingestion pipeline is asynchronous.

POST /v1/ingest
        │
        ▼
      API
        │
        ▼
      Queue
        │
        ▼
     Worker
        │
        ├── Fetch
        ├── Parse
        ├── Clean
        ├── Chunk
        ├── Embed
        └── Store

The API does not sit around waiting for a large PDF or repository to finish processing.

It returns a job:

{
  "jobId": "job_123",
  "status": "queued"
}

The client can later check:

GET /v1/jobs/:id
5. RAG

Atlas uses PostgreSQL + pgvector for the initial implementation.

The basic pipeline:

User Query
    ↓
Query Embedding
    ↓
Vector Search
    ↓
Relevant Chunks
    ↓
Prompt Construction
    ↓
LLM
    ↓
Answer + Citations

A retrieved chunk might look like:

{
  "id": "chunk_123",
  "documentId": "doc_42",
  "content": "Authentication middleware validates...",
  "score": 0.87
}

The final response contains citations:

{
  "answer": "Authentication is handled by the auth middleware...",
  "citations": [
    {
      "documentId": "doc_42",
      "chunkId": "chunk_123"
    }
  ]
}
6. Hybrid Search

Vector search isn't always enough.

For example:

"Postgres P1001"

Keyword search can be extremely useful.

Atlas therefore eventually combines:

Keyword Search
      +
Vector Search
      ↓
Candidate Results
      ↓
Optional Reranking
      ↓
Top K

The first implementation can simply use vector search.

Hybrid retrieval is introduced later as a learning milestone.

1. Agent Runtime

Once RAG works, Atlas introduces agents.

An agent receives a goal:

"Find open authentication issues and create a GitHub issue
containing a summary."

The agent can use tools such as:

knowledge.search
github.searchIssues
github.createIssue
web.search

A simplified agent loop:

             ┌─────────────┐
             │   Planner   │
             └──────┬──────┘
                    ↓
             ┌─────────────┐
             │   Retriever │
             └──────┬──────┘
                    ↓
             ┌─────────────┐
             │    Agent    │
             └──────┬──────┘
                    ↓
             ┌─────────────┐
             │    Tool     │
             └──────┬──────┘
                    ↓
             ┌─────────────┐
             │   Verifier  │
             └──────┬──────┘
                    │
              ┌─────┴─────┐
              │           │
             done       retry

The first version does not need a sophisticated autonomous system.

The goal is to understand:

state
transitions
tool calling
retries
stopping conditions
failures
8. Human Approval

Agents should not automatically perform dangerous actions.

For example:

github.createIssue
github.deleteBranch
docs.update

can require approval.

Flow:

Agent
  ↓
Tool requested
  ↓
Is tool dangerous?
  │
  ├── No ──→ Execute
  │
  └── Yes
        ↓
   Await approval
        ↓
   Human approves
        ↓
     Execute
        ↓
     Verify

This introduces an important concept:

An agent is not just an LLM. It is a state machine around an LLM.

1. Memory

Atlas can store useful facts learned during conversations.

Example:

{
  "fact": "The platform team uses PostgreSQL for primary storage.",
  "confidence": 0.91
}

Memory can later be injected into agent or query context.

Initial memory implementation will be intentionally simple.

The goal is to learn:

memory extraction
memory retrieval
confidence
versioning
deletion
context injection
10. Observability

Every important operation should leave evidence.

For example:

Request
   ↓
Trace
   ├── Retrieval
   ├── LLM call
   ├── Tool call
   └── Database operations

A trace may contain:

{
  "traceId": "trace_123",
  "model": "gemini",
  "promptTokens": 1200,
  "completionTokens": 300,
  "latencyMs": 840,
  "costUsd": 0.0012
}

This makes questions like these answerable:

Why was this request slow?
Which model was used?
How many tokens did it consume?
Which documents were retrieved?
Which tools did the agent execute?
Architecture

Atlas starts with a modular monolith.

                    ┌──────────────────┐
                    │    Next.js UI    │
                    └────────┬─────────┘
                             │
                       REST / SSE
                             │
                             ▼
              ┌──────────────────────────┐
              │       Express API        │
              │                          │
              │  Auth / RBAC             │
              │  Workspaces              │
              │  Documents               │
              │  Query / RAG              │
              │  Agents                  │
              │  Usage                   │
              └───────┬──────────┬───────┘
                      │          │
                      ▼          ▼
                PostgreSQL     Redis
                + pgvector     + BullMQ
                      ▲          │
                      │          ▼
                      │       Worker
                      │          │
                      │          ├── Parse
                      │          ├── Chunk
                      │          └── Embed
                      │
                      ▼
                LLM Providers

The important architectural boundary is:

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

The project deliberately avoids microservices initially.

Request Lifecycle

For a normal RAG request:

Client
  │
  ▼
POST /v1/query
  │
  ▼
Auth
  │
  ▼
RBAC
  │
  ▼
Query Service
  │
  ├── Query normalization
  │
  ├── Retrieve chunks
  │
  ├── Build context
  │
  ├── Call LLM
  │
  └── Store trace
  │
  ▼
Answer + Citations
Ingestion Lifecycle
Client
  │
  ▼
POST /v1/ingest
  │
  ▼
Create Document
  │
  ▼
Create Job
  │
  ▼
Redis / BullMQ
  │
  ▼
Worker
  │
  ├── Fetch
  ├── Parse
  ├── Clean
  ├── Chunk
  ├── Embed
  └── Store
  │
  ▼
Document READY

If something fails:

Worker
  │
  ▼
Error
  │
  ▼
Retry
  │
  ├── success → DONE
  │
  └── failure → FAILED

This is where Atlas starts becoming a backend engineering project rather than just an AI demo.

Repository Structure
atlas/
│
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   └── v1/
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rbac.ts
│   │   │   └── error.ts
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── workspace/
│   │   │   ├── document/
│   │   │   ├── query/
│   │   │   ├── agent/
│   │   │   └── usage/
│   │   │
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   ├── retrieval/
│   │   │   ├── memory/
│   │   │   └── cost/
│   │   │
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── redis.ts
│   │   │   └── logger.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   └── tests/
│
├── worker/
│   └── src/
│       ├── processors/
│       │   ├── file.ts
│       │   ├── url.ts
│       │   └── github.ts
│       │
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

The exact structure may change during development.

Architecture should evolve when the code teaches us that the current structure is no longer appropriate.

Core Data Model

The initial database model is intentionally small.

User
 │
 └── Member
       │
       ▼
   Workspace
      │
      ├── Document
      │      │
      │      └── Chunk
      │
      ├── ApiKey
      │
      ├── AgentRun
      │
      ├── Memory
      │
      └── Trace

Example Prisma models:

model Workspace {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())

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

Vector columns will initially be added using a PostgreSQL migration because Prisma's support for vector types requires additional handling.

Core APIs

Base URL:

/v1
Workspaces
POST /v1/workspaces
{
  "name": "Atlas Engineering"
}
Ingestion
POST /v1/ingest
{
  "type": "url",
  "ref": "<https://example.com/docs>"
}

Response:

{
  "jobId": "job_123",
  "documentId": "doc_123"
}
Job Status
GET /v1/jobs/:id
{
  "status": "processing",
  "progress": 0.6
}

Possible states:

queued
processing
completed
failed
Query
POST /v1/query
{
  "q": "How does authentication work?"
}

Response:

{
  "answer": "Authentication is handled by...",
  "citations": [
    {
      "documentId": "doc_123",
      "chunkId": "chunk_456"
    }
  ]
}
Agent
POST /v1/agent/run
{
  "goal": "Find authentication issues"
}

Response:

{
  "runId": "run_123",
  "status": "running"
}
AI Pipeline
Phase 1: Ingestion
Source
  ↓
Parser
  ↓
Cleaner
  ↓
Chunker
  ↓
Embedding Model
  ↓
PostgreSQL
Chunking

The first implementation will use approximately:

chunk size: ~800 tokens
overlap: ~100 tokens

These numbers are starting points, not universal truths.

One of the goals of the project is to experiment with different chunking strategies and evaluate their effect on retrieval.

Phase 2: Retrieval

Initial implementation:

Query
  ↓
Embedding
  ↓
pgvector
  ↓
Top K chunks

Later:

Query
  │
  ├───────────────┐
  ▼               ▼
Vector Search   Keyword Search
  │               │
  └───────┬───────┘
          ▼
       Merge
          ↓
       Rerank
          ↓
        Top K
Phase 3: Generation

Retrieved chunks become context:

System Instructions
        +
User Question
        +
Retrieved Context
        +
Relevant Memory
        ↓
       LLM
        ↓
Answer

The model should be instructed to ground its response in the retrieved context.

Phase 4: Agents

Agents are introduced only after the RAG pipeline works.

A basic state might look like:

type AgentState = {
  goal: string;
  plan: string[];
  context: Chunk[];
  steps: AgentStep[];
  pendingApproval?: Approval;
};

The agent graph manages transitions between states.

Phase 5: Memory

Memory is deliberately added later.

Conversation
     ↓
Memory Extractor
     ↓
Candidate Fact
     ↓
Confidence Check
     ↓
Store
     ↓
Retrieve Later

The first implementation doesn't need sophisticated long-term memory.

The purpose is to understand the architectural problem.

Observability

Atlas will track basic telemetry.

For an LLM request:

traceId
workspaceId
userId
model
promptTokens
completionTokens
latencyMs
cost

For retrieval:

query
retrievedChunkIds
scores
latency

For agents:

runId
step
tool
arguments
result
duration

This creates an execution trail:

Request
  ↓
Retrieval
  ↓
LLM
  ↓
Tool
  ↓
LLM
  ↓
Response
Caching

Redis will eventually be used for:

caching
rate limiting
job queues
temporary state

The first cache implementation should be simple.

For example:

normalized query
       ↓
Redis
       ↓
cache hit?
   │       │
  yes      no
   │       │
return    RAG
           │
           ▼
         Redis

Semantic caching is intentionally a later feature.

Background Jobs

BullMQ is used to understand asynchronous backend processing.

Example:

API
 │
 │ add job
 ▼
Redis
 │
 ▼
BullMQ
 │
 ▼
Worker
 │
 ├── process
 ├── retry
 └── complete

Important concepts to learn:

job states
retries
exponential backoff
concurrency
idempotency
dead-letter handling
graceful shutdown
Failure Handling

Failures are expected.

For example:

Embedding API
     │
     ▼
   timeout
     │
     ▼
   retry
     │
     ▼
   timeout
     │
     ▼
   retry
     │
     ▼
   success

But some failures should not retry forever.

Eventually:

FAILED
  ↓
error stored
  ↓
visible to user

This is one of the main backend-learning parts of Atlas.

Security

Atlas will implement basic security practices:

password hashing
JWT authentication
API-key hashing
RBAC
input validation with Zod
rate limiting
request size limits
CORS configuration
Helmet
basic prompt-injection handling
workspace isolation

The most important invariant is:

A user must never retrieve data
from a workspace they do not have access to.

Conceptually:

WHERE workspace_id = current_workspace

Every retrieval path must preserve this invariant.

Technology Stack
Area Technology
Language TypeScript
Runtime Node.js
API Express
Validation Zod
Database PostgreSQL
ORM Prisma
Vector Search pgvector
Cache Redis
Queue BullMQ
AI LangChain
Agents LangGraph
Web Search Tavily
Frontend Next.js
Styling Tailwind CSS
Testing Vitest + Supertest
Load Testing k6
Local Infrastructure Docker Compose
Why this stack?

The goal isn't to use every popular tool.

The goal is to learn how a relatively small set of technologies can solve increasingly complex problems.

What Is Explicitly NOT Being Built Initially?

Atlas is intentionally not starting with:

Kubernetes
microservices
Qdrant
Kafka
complex billing
multi-region deployment
distributed tracing infrastructure
sophisticated semantic caching
custom LLM hosting
complex event sourcing
elaborate CI/CD infrastructure

Those technologies may become useful later.

But adding infrastructure before understanding the underlying problem usually produces architecture cosplay.

Atlas is about learning the why before collecting the what.

Development Roadmap

The roadmap is progressive rather than deadline-driven.

Stage 1 — Backend Foundation

Build:

Express server
TypeScript
Zod
PostgreSQL
Prisma
migrations
error handling
logging
basic REST APIs
Goal

Understand the request lifecycle:

HTTP
 ↓
Router
 ↓
Controller
 ↓
Service
 ↓
Repository
 ↓
Database
Stage 2 — Authentication & Workspaces

Build:

users
login
JWT
workspaces
members
roles
RBAC middleware
Goal

Understand multi-tenant authorization.

Important invariant:

workspace A ≠ workspace B

A request authenticated as a member of A must never accidentally query B.

Stage 3 — Document System

Build:

document CRUD
file uploads
document status
metadata
deletion
database indexes
Goal

Become comfortable with PostgreSQL-backed application design.

Stage 4 — Background Jobs

Introduce:

Redis
BullMQ
workers
retries
job status
concurrency

Architecture becomes:

API → Queue → Worker → Database
Goal

Understand asynchronous processing.

Stage 5 — RAG

Build:

document parsing
chunking
embeddings
pgvector
similarity search
prompt construction
citations
Goal

Build a complete RAG pipeline yourself.

Document → Chunk → Embed → Store
                         ↓
Query → Embed → Retrieve → LLM
Stage 6 — Better Retrieval

Add:

metadata filtering
keyword search
hybrid retrieval
reranking experiments
retrieval evaluation
Goal

Understand why:

"better embeddings"

isn't always equivalent to:

"better retrieval"
Stage 7 — Agent Runtime

Introduce LangGraph.

Build:

agent state
planner
retrieval tool
tool calling
execution loop
maximum steps
failure handling
Goal

Understand agents as stateful systems rather than magical chatbots.

Stage 8 — Human Approval

Add:

approval requests
pause/resume
risky-tool classification
approval API
audit records

Example:

Agent
 ↓
github.createIssue
 ↓
Approval Required
 ↓
WAITING
 ↓
Human approves
 ↓
Resume
 ↓
Tool executes
Goal

Learn how to build systems where autonomous execution still has explicit control boundaries.

Stage 9 — Memory

Add:

memory extraction
confidence
memory retrieval
editing
deletion
versioning
Goal

Understand context management beyond a single conversation.

Stage 10 — Observability

Add:

request IDs
trace IDs
LLM usage
latency
token tracking
cost calculation
agent traces
Goal

Answer:

"What exactly happened during this request?"

Stage 11 — Evaluation

Create a small golden dataset:

{
  "question": "How is authentication implemented?",
  "expected": "...",
  "mustContain": ["JWT", "middleware"]
}

Evaluate:

retrieval quality
citation correctness
answer quality
latency
cost
Goal

Learn that AI systems need measurement, not just demos.

Stage 12 — Performance & Scale

Only after the system works:

add indexes
investigate slow queries
load test with k6
tune worker concurrency
measure Redis performance
investigate PostgreSQL query plans
optimize embedding batches
introduce caching

Then ask:

What is actually slow?

Instead of:

What infrastructure can I add?

MVP Definition

Atlas is considered a successful learning project when this works end-to-end:

Create Workspace
       ↓
Upload Document
       ↓
Background Worker Processes It
       ↓
Chunks + Embeddings Stored
       ↓
Ask Question
       ↓
Relevant Chunks Retrieved
       ↓
LLM Generates Answer
       ↓
Answer Contains Citations
       ↓
Trace Is Recorded
       ↓
Agent Uses Knowledge
       ↓
Agent Requests Approval
       ↓
Human Approves
       ↓
Tool Executes

That is enough.

Everything after this is optimization, experimentation, and deeper systems engineering.

Testing Strategy

Atlas uses several layers of testing.

Unit Tests

Test individual pieces:

chunker
RBAC rules
cost calculation
query normalization
agent transitions
API Tests

Test:

authentication
authorization
document APIs
query APIs
agent APIs
Integration Tests

Test:

API
 ↓
PostgreSQL
 ↓
Redis
 ↓
Worker
RAG Evaluation

Test whether retrieval and generated answers are actually useful.

Load Testing

Use k6 to understand:

requests/sec
latency
error rate
database pressure
worker throughput
Local Development

Only stateful infrastructure runs in Docker:

Docker
 ├── PostgreSQL
 └── Redis

Node services run directly on the machine.

docker compose up -d

Then:

cd server
npm install
npm run dev

Worker:

cd worker
npm install
npm run dev

Dashboard:

cd dashboard
npm install
npm run dev

This keeps development relatively lightweight.

Environment Variables

Example:

DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas

REDIS_URL=redis://localhost:6379

JWT_SECRET=your-secret

GOOGLE_API_KEY=your-key

TAVILY_API_KEY=your-key

PORT=4000

NEXT_PUBLIC_API_URL=<http://localhost:4000>

Never commit real secrets.

Engineering Principles

Atlas follows a few rules.

1. Understand before abstracting

Don't create five interfaces for something that currently has one implementation.

1. Measure before optimizing

If PostgreSQL is slow:

measure
  ↓
EXPLAIN ANALYZE
  ↓
identify bottleneck
  ↓
optimize

Don't immediately add another database.

1. Prefer simple architecture first

Start:

Modular Monolith

not:

Microservices + Kafka + Kubernetes + 14 dashboards
4. Make failures explicit

Every asynchronous operation should have a meaningful state.

QUEUED
PROCESSING
COMPLETED
FAILED
5. Preserve invariants

The most important Atlas invariant:

workspaceId must propagate through every
authorization and retrieval boundary.
6. Build features in vertical slices

Instead of:

Build entire database
Build entire backend
Build entire AI system
Build frontend

Build:

Create workspace
     ↓
API
     ↓
Database
     ↓
UI

Then:

Upload document
     ↓
Queue
     ↓
Worker
     ↓
Database
     ↓
UI

Then:

Query
     ↓
Retrieval
     ↓
LLM
     ↓
Citations

This keeps every stage executable.

What I Expect to Learn From Atlas

By the end, I should be able to explain:

Backend
How an HTTP request moves through an application.
Where business logic belongs.
How transactions work.
How PostgreSQL indexes affect queries.
How authentication differs from authorization.
How multi-tenancy can fail.
Distributed Systems
Why background jobs exist.
How queues work.
Why retries can create duplicate work.
What idempotency means.
How rate limiting works.
Why caches are difficult to invalidate.
What eventual consistency looks like in practice.
RAG
How embeddings represent semantic relationships.
How vector search works.
Why chunking affects retrieval.
Why retrieval quality matters more than simply increasing context.
How citations can be tied back to source chunks.
Agents
Why an agent is fundamentally a state machine.
How tools are represented.
How execution can be paused.
Why approvals matter.
How agents fail.
Production Thinking
How to measure latency.
How to track cost.
How to inspect failures.
How to load test.
How to identify bottlenecks.
When infrastructure should actually be introduced.
Final Architecture

The final learning architecture should roughly look like:

                         ┌──────────────────┐
                         │     Next.js      │
                         │    Dashboard     │
                         └────────┬─────────┘
                                  │
                              HTTP / SSE
                                  │
                                  ▼
                   ┌──────────────────────────┐
                   │       Express API        │
                   │                          │
                   │ Auth / RBAC              │
                   │ Workspaces               │
                   │ Documents                │
                   │ Query / RAG              │
                   │ Agents                   │
                   │ Usage / Traces           │
                   └───────┬──────────┬───────┘
                           │          │
                           │          ▼
                           │       Redis
                           │          │
                           │       BullMQ
                           │          │
                           │          ▼
                           │        Worker
                           │          │
                           │    ┌─────┴─────┐
                           │    │           │
                           │  Parse       Embed
                           │    │           │
                           │    └─────┬─────┘
                           │          │
                           ▼          ▼
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    │                     │
                    │ Relational Data     │
                    │ + pgvector          │
                    └──────────┬──────────┘
                               │
                               ▼
                       ┌───────────────┐
                       │ LLM Providers │
                       └───────────────┘

The architecture is intentionally allowed to evolve.

If a bottleneck appears, investigate it.

If a boundary becomes painful, redesign it.

If a new infrastructure component solves a demonstrated problem, introduce it.

Don't build the architecture you think a 10-million-user company needs.

Build the architecture that teaches you why a 10-million-user company needs it.

Status

🚧 Learning Project / In Development

Atlas is being built primarily as an engineering learning project.

It is not intended to be production-ready software.

The architecture, APIs, database schema, and technology choices will evolve as new concepts are learned and tested.

License

MIT
