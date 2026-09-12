import { z } from "zod";

import {
  DocumentSourceType,
  DocumentStatus,
} from "./document.schema.js";

const SOURCE_TYPES = Object.values(
  DocumentSourceType,
) as [string, ...string[]];

const STATUSES = Object.values(
  DocumentStatus,
) as [string, ...string[]];

export const documentIdParamSchema = z.object({
  documentId: z.string().min(1, "documentId is required"),
});

const metadataSchema = z
  .object({
    author: z
      .string()
      .trim()
      .max(200, "Author must be ≤ 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be ≤ 2000 characters")
      .optional(),
    language: z
      .string()
      .trim()
      .max(20, "Language must be ≤ 20 characters")
      .optional(),
    pageCount: z.number().int().positive().optional(),
    wordCount: z.number().int().nonnegative().optional(),
  })
  .strict()
  .optional();

const sourceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(500, "Source name must be ≤ 500 characters")
      .optional(),
    url: z.string().trim().url("Source url must be a valid URL").optional(),
    mimeType: z.string().trim().max(150).optional(),
    size: z.number().int().nonnegative().optional(),
  })
  .strict()
  .optional();

// JSON creation: text / markdown / url sources, or a placeholder
// record for a file that will be uploaded/processed async.
export const createDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(300, "Title must be ≤ 300 characters"),
    sourceType: z.enum(SOURCE_TYPES),
    source: sourceSchema,
    content: z
      .string()
      .max(5_000_000, "Content is too large")
      .optional(),
    metadata: metadataSchema,
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === DocumentSourceType.URL && !data.source?.url) {
      ctx.addIssue({
        code: "custom",
        path: ["source", "url"],
        message: "source.url is required when sourceType is 'url'",
      });
    }
  });

// Multipart upload: title/metadata come as text fields alongside
// the file. sourceType is derived from the file MIME when omitted.
export const uploadDocumentBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(300, "Title must be ≤ 300 characters")
    .optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  author: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  language: z.string().trim().max(20).optional(),
});

export const updateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(300, "Title must be ≤ 300 characters")
      .optional(),
    content: z
      .string()
      .max(5_000_000, "Content is too large")
      .optional(),
    status: z.enum(STATUSES).optional(),
    error: z.string().trim().max(2000).optional(),
    metadata: metadataSchema,
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.content !== undefined ||
      data.status !== undefined ||
      data.error !== undefined ||
      data.metadata !== undefined,
    { message: "Provide at least one field to update" },
  );

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(STATUSES).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  search: z.string().trim().max(200).optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UploadDocumentBodyInput = z.infer<
  typeof uploadDocumentBodySchema
>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
