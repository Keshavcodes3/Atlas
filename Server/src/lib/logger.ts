type Level = "info" | "warn" | "error" | "debug";

function log(level: Level, message: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.log;
  fn(`[${ts}] [${level.toUpperCase()}] ${message}`, ...args);
}

// Minimal structured logger so RAG/worker code doesn't scatter raw
// console.* calls. Keeps the `logger.info/error` call sites stable —
// swap this file for pino/winston later without touching callers.
export const logger = {
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  error: (message: string, ...args: unknown[]) =>
    log("error", message, ...args),
  debug: (message: string, ...args: unknown[]) =>
    log("debug", message, ...args),
};
