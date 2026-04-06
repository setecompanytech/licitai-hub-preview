type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  module: string;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
  timestamp: string;
};

class Logger {
  private module: string;
  constructor(module: string) { this.module = module; }

  private log(level: LogLevel, message: string, error?: unknown, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      module: this.module,
      message,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      context,
      timestamp: new Date().toISOString(),
    };

    if (import.meta.env.DEV) {
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(`[PRAEFECTUS/${this.module}]`, message, error ?? "", context ?? "");
    }

    if (import.meta.env.PROD && (level === "warn" || level === "error")) {
      this.persist(entry).catch(() => {});
    }
  }

  private async persist(entry: LogEntry) {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.from("system_logs" as any).insert({
        level: entry.level,
        module: entry.module,
        message: entry.message,
        error_details: entry.error ? JSON.stringify(entry.error) : null,
        context: entry.context ? JSON.stringify(entry.context) : null,
      } as any);
    } catch { /* persist failure must never throw */ }
  }

  debug(msg: string, context?: Record<string, unknown>) { this.log("debug", msg, undefined, context); }
  info(msg: string, context?: Record<string, unknown>) { this.log("info", msg, undefined, context); }
  warn(msg: string, error?: unknown, context?: Record<string, unknown>) { this.log("warn", msg, error, context); }
  error(msg: string, error?: unknown, context?: Record<string, unknown>) { this.log("error", msg, error, context); }
}

export const createLogger = (module: string) => new Logger(module);
