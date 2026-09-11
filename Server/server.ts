import dotenv from "dotenv";

dotenv.config();

import app from "./src/app.js";
import { mongoDB } from "./src/lib/db/mongodb.js";

const PORT = Number(process.env.PORT ?? 4000);

async function bootstrap(): Promise<void> {
  await mongoDB.connect();

  const server = app.listen(PORT, () => {
    console.log(`API listening on :${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await mongoDB.disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
