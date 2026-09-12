import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.js";
import authRoutes from "./modules/auth/auth.routes.js";
import documentRoutes from "./modules/document/document.routes.js";
import queryRoutes from "./modules/query/query.routes.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";

dotenv.config();

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL ?? true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  // 6mb: document JSON allows content up to 5MB (validated by Zod).
  // The old 1mb limit rejected large-but-valid payloads with a bare
  // 413 before Zod could return a structured VALIDATION_ERROR.
  app.use(express.json({ limit: "6mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/v1/auth", authRoutes);
  app.use("/v1/workspaces", workspaceRoutes);
  app.use("/v1/workspaces/:workspaceId/documents", documentRoutes);
  app.use("/v1/workspaces/:workspaceId/query", queryRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
