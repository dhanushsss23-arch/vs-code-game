type LogContext = Record<string, string | number | boolean | null>;

export function logError(event: string, error: unknown, context: LogContext = {}): void {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error(JSON.stringify({ level: "error", event, errorName, ...context }));
}
