/** Thrown when a JSON book save loses an optimistic concurrency check. */
export class BookConflictError extends Error {
  readonly status = 409 as const;

  constructor(message = "This was updated elsewhere. Refresh and try again.") {
    super(message);
    this.name = "BookConflictError";
  }
}

export function isBookConflict(err: unknown): err is BookConflictError {
  return (
    err instanceof BookConflictError ||
    (Boolean(err) &&
      typeof err === "object" &&
      (err as { name?: string }).name === "BookConflictError")
  );
}
