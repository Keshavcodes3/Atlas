import {
  ArrowRight,
  Boxes,
  FileText,
  GitBranch,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
} from "lucide-react";

interface Props {
  onSignIn: () => void;
}

const PIPELINE = [
  { icon: FileText, label: "Ingest", sub: "PDF · MD · URL" },
  { icon: Boxes, label: "Chunk + Embed", sub: "~800 tok" },
  { icon: ScanSearch, label: "Retrieve", sub: "workspace-scoped" },
  { icon: Sparkles, label: "Answer", sub: "with citations" },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Workspaces + RBAC",
    body: "OWNER / EDITOR / VIEWER. Authorization runs before business logic — every query is scoped with workspace isolation.",
  },
  {
    icon: Workflow,
    title: "Async ingestion",
    body: "Uploads return instantly with pending → processing → ready → failed. No request ever blocks on a big PDF.",
  },
  {
    icon: ScanSearch,
    title: "Grounded RAG",
    body: "Retrieved chunks become cited context. Answers trace back to chunk_123 in doc_42 — never hallucinations alone.",
  },
  {
    icon: GitBranch,
    title: "Agent-ready state",
    body: "Agents are state machines around an LLM: plan, retrieve, request approval, execute, verify. Dangerous tools pause.",
  },
  {
    icon: Timer,
    title: "Observable by default",
    body: "Every LLM call leaves a trace: model, tokens, latency, cost. Slow request? Read the trail.",
  },
  {
    icon: Lock,
    title: "Secure sessions",
    body: "bcrypt hashing, httpOnly JWT cookies with Bearer fallback, Zod validation, Helmet, 1 MB payload limits.",
  },
];

export default function Landing({ onSignIn }: Props) {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="brand">
            <span className="brand-mark">A</span>
            <span className="brand-name">Atlas</span>
            <span className="brand-tag">knowledge engine</span>
          </div>
          <nav className="lp-links">
            <a href="#pipeline">Pipeline</a>
            <a href="#features">Features</a>
            <a href="#rbac">RBAC</a>
            <a href="#api">API</a>
          </nav>
          <button type="button" className="btn btn-primary" onClick={onSignIn}>
            Sign in <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-bg" aria-hidden="true" />
          <div className="lp-hero-inner">
            <p className="pill">
              <Sparkles size={14} /> Team knowledge + action engine
            </p>
            <h1>
              Ask your docs.
              <br />
              <span className="grad">Ship the answer with proof.</span>
            </h1>
            <p className="lede">
              Atlas connects PDFs, Markdown and URLs into workspace-scoped
              knowledge, retrieves the right chunks, and generates cited
              answers — with auth, RBAC and background jobs built in.
            </p>
            <div className="lp-cta">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={onSignIn}
              >
                Sign in to workspace <ArrowRight size={17} />
              </button>
              <a href="#api" className="btn btn-ghost btn-lg">
                See the API flow
              </a>
            </div>
            <div className="lp-stats">
              <div>
                <strong>7</strong>
                <span>enforced permissions</span>
              </div>
              <div>
                <strong>4</strong>
                <span>document states</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>workspace-isolated reads</span>
              </div>
            </div>
          </div>
        </section>

        <section id="pipeline" className="lp-section">
          <h2>One pipeline, end to end</h2>
          <p className="sec-sub">
            The API never blocks on heavy work — it enqueues, the worker
            processes, the client polls.
          </p>
          <div className="pipe">
            {PIPELINE.map((s, i) => (
              <div className="pipe-step" key={s.label}>
                <span className="pipe-icon">
                  <s.icon size={20} />
                </span>
                <strong>{s.label}</strong>
                <span className="pipe-sub">{s.sub}</span>
                {i < PIPELINE.length - 1 && (
                  <span className="pipe-arrow" aria-hidden="true">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="lp-section">
          <h2>Backend-first, not demo-first</h2>
          <p className="sec-sub">
            Every feature maps to a real backend concern — not a mock.
          </p>
          <div className="feat-grid">
            {FEATURES.map((f) => (
              <article className="feat" key={f.title}>
                <span className="feat-icon">
                  <f.icon size={19} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="rbac" className="lp-section lp-split">
          <div>
            <h2>Permissions before logic</h2>
            <p className="sec-sub">
              The middleware chain is always{" "}
              <code>requireAuth → loadMembership → requirePermission</code>.
              The service layer re-checks membership too, so a forgotten
              middleware can&apos;t leak another workspace.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSignIn}
            >
              Sign in to manage members <ArrowRight size={15} />
            </button>
          </div>
          <div className="rbac-card">
            <table>
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Owner</th>
                  <th>Editor</th>
                  <th>Viewer</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Query knowledge", "✓", "✓", "✓"],
                  ["Upload documents", "✓", "✓", "—"],
                  ["Delete documents", "✓", "✓", "—"],
                  ["Manage members", "✓", "—", "—"],
                  ["Approve actions", "✓", "✓", "—"],
                ].map((r) => (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td className="yes">{r[1]}</td>
                    <td className={r[2] === "✓" ? "yes" : "no"}>{r[2]}</td>
                    <td className={r[3] === "✓" ? "yes" : "no"}>{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="api" className="lp-section">
          <h2>Integrated with the backend</h2>
          <p className="sec-sub">
            This UI talks to the live Express API over cookies + Bearer
            fallback. Sign in, pick a workspace, manage documents.
          </p>
          <div className="term">
            <div className="term-bar">
              <i />
              <i />
              <i />
              <span>atlas — api flow</span>
            </div>
            <pre>{`POST /v1/auth/login            →  { user, token } + httpOnly cookie
GET  /v1/auth/me              →  { user }
GET  /v1/workspaces           →  { workspaces: [...] }
POST /v1/workspaces           →  { workspace }
GET  /v1/workspaces/:id/documents?page=1&limit=20
POST /v1/workspaces/:id/documents/upload   (multipart)`}</pre>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span>
          <strong>Atlas</strong> · learning project · Express + MongoDB + RAG
          roadmap
        </span>
        <button type="button" className="linklike" onClick={onSignIn}>
          Sign in →
        </button>
      </footer>
    </div>
  );
}
