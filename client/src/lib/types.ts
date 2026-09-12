export interface ApiUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type WorkspaceRole = "OWNER" | "EDITOR" | "VIEWER";

export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: WorkspaceMember[];
  settings: {
    allowMemberUpload: boolean;
    allowMemberQuery: boolean;
  };
  createdAt: string;
  updatedAt: string;
  currentUserRole?: WorkspaceRole;
}

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";
export type DocumentSourceType =
  | "pdf"
  | "text"
  | "markdown"
  | "docx"
  | "csv"
  | "url";

export interface Doc {
  id: string;
  workspaceId: string;
  uploadedBy: string;
  title: string;
  sourceType: DocumentSourceType;
  source?: {
    name?: string;
    url?: string;
    mimeType?: string;
    size?: number;
  };
  storage?: {
    fileId: string;
    url: string;
    path: string;
  };
  content?: string;
  chunkCount: number;
  status: DocumentStatus;
  error?: string;
  metadata?: {
    author?: string;
    description?: string;
    language?: string;
    pageCount?: number;
    wordCount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
