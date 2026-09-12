import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { api, apiErrorMessage } from "../lib/api";
import type {
  Doc,
  DocumentSourceType,
  DocumentStatus,
  Pagination,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from "../lib/types";
import { useAuth } from "../store/auth";

type Tab = "documents" | "members" | "overview";

const STATUS_STYLE: Record<DocumentStatus, string> = {
  pending: "st-pending",
  processing: "st-processing",
  ready: "st-ready",
  failed: "st-failed",
};

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await api.get<{ workspaces: Workspace[] }>("/v1/workspaces");
  return res.data.workspaces;
}

export default function WorkspaceApp() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const qc = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("documents");
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const wsQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
  });

  const workspaces = useMemo(
    () => wsQuery.data ?? [],
    [wsQuery.data],
  );
  const active =
    workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3200);
  };

  return (
    <div className="app">
      <header className="app-top">
        <div className="brand">
          <span className="brand-mark sm">A</span>
          <span className="brand-name">Atlas</span>
          <span className="env-dot" title="backend linked">
            <i className={wsQuery.isError ? "dot bad" : "dot"} />
            {wsQuery.isError ? "api offline" : "api linked"}
          </span>
        </div>
        <div className="app-user">
          <span className="avatar">
            {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="uinfo">
            <strong>{user?.name}</strong>
            <em>{user?.email}</em>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void logout()}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      {notice && <p className="toast">{notice}</p>}

      <div className="app-body">
        <aside className="side">
          <div className="side-head">
            <h2>Workspaces</h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus size={15} /> New
            </button>
          </div>

          {showCreate && (
            <CreateWorkspaceForm
              onDone={(ws) => {
                setShowCreate(false);
                void qc.invalidateQueries({ queryKey: ["workspaces"] });
                setActiveId(ws.id);
                flash(`Workspace “${ws.name}” created`);
              }}
              onCancel={() => setShowCreate(false)}
            />
          )}

          {wsQuery.isPending && (
            <p className="muted">
              <Loader2 size={15} className="spin" /> Loading workspaces…
            </p>
          )}
          {wsQuery.isError && (
            <div className="err-box">
              <p>{apiErrorMessage(wsQuery.error)}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void wsQuery.refetch()}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          <ul className="ws-list">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className={w.id === active?.id ? "ws-item on" : "ws-item"}
                  onClick={() => {
                    setActiveId(w.id);
                    setTab("documents");
                  }}
                >
                  <span className="ws-ava">
                    {w.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="ws-meta">
                    <strong>{w.name}</strong>
                    <em>
                      {w.currentUserRole ?? "member"} · {w.members.length}{" "}
                      members
                    </em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {workspaces.length === 0 && wsQuery.isSuccess && (
            <p className="muted">
              No workspaces yet — create your first one to start ingesting
              knowledge.
            </p>
          )}
        </aside>

        <main className="stage">
          {!active ? (
            <div className="empty">
              <FileText size={28} />
              <h2>Select or create a workspace</h2>
              <p>
                Workspaces isolate documents, members and retrieval. Everything
                you see here is scoped to the active workspace id.
              </p>
            </div>
          ) : (
            <div key={active.id}>
              <div className="ws-hero">
                <div>
                  <p className="crumb">
                    workspace · {active.currentUserRole ?? "member"}
                  </p>
                  <h1>{active.name}</h1>
                  {active.description && <p>{active.description}</p>}
                </div>
                <div className="tabs">
                  {(
                    [
                      ["documents", "Documents"],
                      ["members", "Members"],
                      ["overview", "Overview"],
                    ] as Array<[Tab, string]>
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={tab === id ? "tab on" : "tab"}
                      onClick={() => setTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "documents" && (
                <DocumentsPanel workspaceId={active.id} onFlash={flash} />
              )}
              {tab === "members" && (
                <MembersPanel
                  workspaceId={active.id}
                  members={active.members}
                  onFlash={flash}
                />
              )}
              {tab === "overview" && <OverviewPanel ws={active} />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------------- create workspace ---------------- */

function CreateWorkspaceForm({
  onDone,
  onCancel,
}: {
  onDone: (ws: Workspace) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setErr("Workspace name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<{ workspace: Workspace }>("/v1/workspaces", {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      onDone(res.data.workspace);
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mini-form">
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          maxLength={100}
          placeholder="e.g. Platform Engineering"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Description (optional)</span>
        <input
          value={description}
          maxLength={500}
          placeholder="What lives in this workspace?"
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {err && <p className="server-err">{err}</p>}
      <div className="row">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Creating…" : "Create workspace"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------------- documents ---------------- */

function DocumentsPanel({
  workspaceId,
  onFlash,
}: {
  workspaceId: string;
  onFlash: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | DocumentStatus>("");
  const [showNew, setShowNew] = useState(false);

  // NOTE: parent remounts this panel via key={workspaceId},
  // so `page` starts at 1 for every workspace — no reset effect needed.

  const key = ["documents", workspaceId, page, search, status];
  const docsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const res = await api.get<{
        documents: Doc[];
        pagination: Pagination;
      }>(`/v1/workspaces/${workspaceId}/documents?${params.toString()}`);
      return res.data;
    },
  });

  const remove = async (doc: Doc) => {
    if (!window.confirm(`Delete “${doc.title}”?`)) return;
    try {
      await api.delete(
        `/v1/workspaces/${workspaceId}/documents/${doc.id}`,
      );
      onFlash(`Deleted “${doc.title}”`);
      await qc.invalidateQueries({ queryKey: ["documents", workspaceId] });
    } catch (e) {
      onFlash(apiErrorMessage(e));
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div className="searchbar">
          <Search size={15} />
          <input
            value={search}
            placeholder="Search titles…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | DocumentStatus);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="">All states</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="ready">ready</option>
            <option value="failed">failed</option>
          </select>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void docsQuery.refetch()}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowNew((v) => !v)}
          >
            <Plus size={15} /> Add document
          </button>
        </div>
      </div>

      {showNew && (
        <AddDocument
          workspaceId={workspaceId}
          onDone={() => {
            setShowNew(false);
            void qc.invalidateQueries({
              queryKey: ["documents", workspaceId],
            });
          }}
          onFlash={onFlash}
        />
      )}

      {docsQuery.isPending && (
        <p className="muted">
          <Loader2 size={15} className="spin" /> Loading documents…
        </p>
      )}
      {docsQuery.isError && (
        <p className="server-err">{apiErrorMessage(docsQuery.error)}</p>
      )}

      <ul className="doc-list">
        {(docsQuery.data?.documents ?? []).map((d) => (
          <li key={d.id} className="doc">
            <span className="doc-ic">
              <FileText size={18} />
            </span>
            <span className="doc-meta">
              <strong>{d.title}</strong>
              <em>
                {d.sourceType} · {d.metadata?.wordCount ?? 0} words ·{" "}
                {new Date(d.createdAt).toLocaleDateString()}
              </em>
              {d.error && <em className="derr">{d.error}</em>}
            </span>
            <span className={`badge ${STATUS_STYLE[d.status]}`}>
              {d.status}
            </span>
            <button
              type="button"
              className="icon-btn danger"
              title="Delete document"
              onClick={() => void remove(d)}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>

      {(docsQuery.data?.documents.length ?? -1) === 0 && (
        <div className="empty slim">
          <h3>No documents match</h3>
          <p>
            Add a note, a URL record, or upload a file. New records start as{" "}
            <code>pending</code> for the background worker.
          </p>
        </div>
      )}

      {docsQuery.data && (
        <div className="pager">
          <span>
            Page {docsQuery.data.pagination.page} of{" "}
            {docsQuery.data.pagination.totalPages} ·{" "}
            {docsQuery.data.pagination.total} total
          </span>
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={page >= docsQuery.data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AddDocument({
  workspaceId,
  onDone,
  onFlash,
}: {
  workspaceId: string;
  onDone: () => void;
  onFlash: (m: string) => void;
}) {
  const [mode, setMode] = useState<"note" | "url" | "file">("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "file") {
        if (!file) throw new Error("Choose a file first");
        const fd = new FormData();
        fd.append("file", file);
        if (title.trim()) fd.append("title", title.trim());
        await api.post(
          `/v1/workspaces/${workspaceId}/documents/upload`,
          fd,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        onFlash(`Uploaded “${file.name}” (pending)`);
      } else if (mode === "url") {
        if (!title.trim()) throw new Error("Title is required");
        if (!url.trim()) throw new Error("URL is required");
        await api.post(`/v1/workspaces/${workspaceId}/documents`, {
          title: title.trim(),
          sourceType: "url" satisfies DocumentSourceType,
          source: { url: url.trim() },
        });
        onFlash(`Saved URL “${title.trim()}”`);
      } else {
        if (!title.trim()) throw new Error("Title is required");
        await api.post(`/v1/workspaces/${workspaceId}/documents`, {
          title: title.trim(),
          sourceType: "markdown" satisfies DocumentSourceType,
          ...(content.trim() ? { content: content } : {}),
        });
        onFlash(`Created “${title.trim()}” (pending)`);
      }
      onDone();
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mini-form wide">
      <div className="tabs slim">
        {(
          [
            ["note", "Note"],
            ["url", "URL"],
            ["file", "File upload"],
          ] as Array<["note" | "url" | "file", string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={mode === id ? "tab on" : "tab"}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Title</span>
        <input
          value={title}
          maxLength={300}
          placeholder={
            mode === "url" ? "e.g. Auth RFC" : "e.g. Onboarding notes"
          }
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      {mode === "note" && (
        <label className="field">
          <span>Content (markdown, optional)</span>
          <textarea
            value={content}
            rows={4}
            placeholder="Paste the knowledge to store…"
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
      )}
      {mode === "url" && (
        <label className="field">
          <span>Source URL</span>
          <input
            value={url}
            placeholder="https://…"
            inputMode="url"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      )}
      {mode === "file" && (
        <label className="field">
          <span>File (pdf · txt · md · csv · image, ≤10 MB)</span>
          <span className="file-row">
            <Upload size={15} />
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </span>
        </label>
      )}

      {err && <p className="server-err">{err}</p>}
      <div className="row">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Saving…" : "Save document"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onDone}
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ---------------- members ---------------- */

function MembersPanel({
  workspaceId,
  members,
  onFlash,
}: {
  workspaceId: string;
  members: WorkspaceMember[];
  onFlash: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("VIEWER");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["workspaces"] });

  const add = async () => {
    if (!email.trim()) {
      setErr("Enter the member's email");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/v1/workspaces/${workspaceId}/members`, {
        email: email.trim(),
        role,
      });
      setEmail("");
      onFlash(`Added ${email.trim()} as ${role}`);
      await refresh();
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setRoleFor = async (userId: string, next: WorkspaceRole) => {
    try {
      await api.patch(
        `/v1/workspaces/${workspaceId}/members/${userId}`,
        { role: next },
      );
      onFlash(`Role updated to ${next}`);
      await refresh();
    } catch (e) {
      onFlash(apiErrorMessage(e));
    }
  };

  const kick = async (userId: string) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await api.delete(
        `/v1/workspaces/${workspaceId}/members/${userId}`,
      );
      onFlash("Member removed");
      await refresh();
    } catch (e) {
      onFlash(apiErrorMessage(e));
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          <Users size={16} /> {members.length} members
        </h3>
      </div>

      <div className="mini-form wide">
        <div className="mem-add">
          <label className="field grow">
            <span>Invite by email (owner only)</span>
            <input
              value={email}
              placeholder="teammate@company.com"
              inputMode="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            >
              <option value="VIEWER">VIEWER</option>
              <option value="EDITOR">EDITOR</option>
              <option value="OWNER">OWNER</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm self-end"
            disabled={busy}
            onClick={() => void add()}
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        {err && <p className="server-err">{err}</p>}
      </div>

      <ul className="mem-list">
        {members.map((m) => (
          <li key={m.userId} className="mem">
            <span className="avatar sm">
              {m.userId.slice(0, 1).toUpperCase()}
            </span>
            <span className="doc-meta">
              <strong className="mono">{m.userId.slice(0, 12)}…</strong>
              <em>joined {new Date(m.joinedAt).toLocaleDateString()}</em>
            </span>
            <select
              value={m.role}
              onChange={(e) =>
                void setRoleFor(
                  m.userId,
                  e.target.value as WorkspaceRole,
                )
              }
              aria-label="Member role"
            >
              <option value="OWNER">OWNER</option>
              <option value="EDITOR">EDITOR</option>
              <option value="VIEWER">VIEWER</option>
            </select>
            <button
              type="button"
              className="icon-btn danger"
              title="Remove member"
              onClick={() => void kick(m.userId)}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- overview ---------------- */

function OverviewPanel({ ws }: { ws: Workspace }) {
  return (
    <section className="panel grid2">
      <div className="ov-card">
        <h3>Workspace</h3>
        <dl>
          <div>
            <dt>ID</dt>
            <dd className="mono">{ws.id}</dd>
          </div>
          <div>
            <dt>Your role</dt>
            <dd>{ws.currentUserRole ?? "—"}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd className="mono">{ws.ownerId.slice(0, 12)}…</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(ws.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </div>
      <div className="ov-card">
        <h3>Capabilities</h3>
        <ul className="caps">
          <li>
            Member upload:{" "}
            <strong>{ws.settings.allowMemberUpload ? "on" : "off"}</strong>
          </li>
          <li>
            Member query:{" "}
            <strong>{ws.settings.allowMemberQuery ? "on" : "off"}</strong>
          </li>
          <li>
            Retrieval scope: <strong>workspace-only</strong>
          </li>
          <li>
            Ingestion: <strong>async worker (pending → ready)</strong>
          </li>
        </ul>
        <p className="muted small">
          RAG query, agents and traces land here next — the backend stubs are
          already reserved under <code>/v1/query</code> and{" "}
          <code>/v1/agent</code>.
        </p>
      </div>
    </section>
  );
}
