import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { errorHandler, notFoundHandler, } from "./middleware/error.js";
import authRoutes from "./modules/auth/auth.routes.js";
import workspaceRoutes from "./modules/workspace/workspace.routes.js";
dotenv.config();
export function createApp() {
    const app = express();
    app.use(helmet());
    app.use(cors({
        origin: process.env.CLIENT_URL ?? true,
        credentials: true,
    }));
    app.use(cookieParser());
    app.use(express.json({ limit: "1mb" }));
    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });
    app.use("/v1/auth", authRoutes);
    app.use("/v1/workspaces", workspaceRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
export default createApp();
