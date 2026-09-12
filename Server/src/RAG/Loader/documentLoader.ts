import { Document } from "@langchain/core/documents";
import { RecursiveUrlLoader } from "@langchain/community/document_loaders/web/recursive_url";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { compile } from "html-to-text";
import mammoth from "mammoth";
import { Types } from "mongoose";

import { DocumentModel } from "../../modules/document/document.schema.js";

export interface LoadedSource {
  /** LangChain docs with normalized metadata (documentId always set). */
  docs: Document[];
  workspaceId: string;
}

function baseMetadata(document: {
  _id: unknown;
  workspaceId: unknown;
  sourceType: string;
}) {
  return {
    documentId: String(document._id),
    workspaceId: String(document.workspaceId),
    sourceType: document.sourceType,
  };
}

/**
 * Load raw text for a document as LangChain Documents.
 *
 * Priority: inline `document.content` (JSON-created text/markdown/csv
 * docs, and file uploads that extracted text at upload time) wins over
 * fetching `storage.url`. Why: JSON docs have no remote file at all —
 * the old code threw "storage URL missing" for them even though the
 * text was already in the DB.
 *
 * Always returns real `Document` instances (the old text/md branch
 * returned plain `{pageContent, metadata}` objects, which breaks
 * `splitDocuments()` typing and any code expecting Document methods).
 */
export const DocumentLoader = async (docId: string): Promise<LoadedSource> => {
  if (!Types.ObjectId.isValid(docId)) {
    throw new Error("Invalid document ID");
  }

  const document = await DocumentModel.findById(docId).exec();
  if (!document) {
    throw new Error("Document not found");
  }

  const meta = baseMetadata(document);
  const sourceType = document.sourceType;

  // --- URL: crawl (unchanged behavior, tightened) ---------------------
  if (sourceType === "url") {
    if (!document.source.url) {
      throw new Error("URL source is missing");
    }
    const compiledConvert = compile({ wordwrap: 130 });
    const loader = new RecursiveUrlLoader(document.source.url, {
      maxDepth: 1, // was 2: depth-2 crawls explode page count + cost
      extractor: (html: string) => compiledConvert(html),
      excludeDirs: ["/api/v1"],
    });
    const docs = await loader.load();
    // Tag every crawled page so chunks stay attributable.
    for (const d of docs) {
      d.metadata = { ...meta, ...d.metadata, ...baseMetadata(document) };
    }
    if (docs.length === 0) {
      throw new Error("URL loader returned no readable content");
    }
    return { docs, workspaceId: String(document.workspaceId) };
  }

  // --- Inline content wins for text-like types ------------------------
  if (document.content && document.content.trim().length > 0) {
    if (
      sourceType === "text" ||
      sourceType === "markdown" ||
      sourceType === "csv" ||
      sourceType === "docx"
    ) {
      return {
        docs: [
          new Document({
            pageContent: document.content,
            metadata: { ...meta, source: "inline" },
          }),
        ],
        workspaceId: String(document.workspaceId),
      };
    }
    // pdf with inline content falls through to remote parse below —
    // inline text for PDFs is only a preview, not the full document.
  }

  // --- Remote file via ImageKit ---------------------------------------
  if (!document.storage?.url) {
    throw new Error(
      "Document has no readable text (no inline content and no storage URL)",
    );
  }

  const response = await fetch(document.storage.url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch file: ${response.status} ${response.statusText}`,
    );
  }

  switch (sourceType) {
    case "pdf": {
      const blob = await response.blob();
      const loader = new WebPDFLoader(blob);
      const docs = await loader.load();
      for (const d of docs) {
        d.metadata = { ...meta, ...d.metadata, ...baseMetadata(document) };
      }
      return { docs, workspaceId: String(document.workspaceId) };
    }

    case "text":
    case "markdown":
    case "csv": {
      const text = await response.text();
      if (!text.trim()) throw new Error("File is empty");
      return {
        docs: [
          new Document({
            pageContent: text,
            metadata: { ...meta, source: document.storage.url },
          }),
        ],
        workspaceId: String(document.workspaceId),
      };
    }

    case "docx": {
      // mammoth works on Buffer — no temp file needed (the old
      // code threw here even though `mammoth` was already installed).
      const buffer = Buffer.from(await response.arrayBuffer());
      const { value } = await mammoth.extractRawText({ buffer });
      if (!value.trim()) throw new Error("DOCX contains no readable text");
      return {
        docs: [
          new Document({
            pageContent: value,
            metadata: { ...meta, source: document.storage.url },
          }),
        ],
        workspaceId: String(document.workspaceId),
      };
    }

    default:
      throw new Error(`Unsupported document source type: ${sourceType}`);
  }
};
