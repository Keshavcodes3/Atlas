import { z } from "zod";

export const queryBodySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "q is required")
    .max(2000, "Query must be ≤ 2000 characters"),
  topK: z.number().int().min(1).max(20).default(5).optional(),
});

export type QueryBodyInput = z.infer<typeof queryBodySchema>;
