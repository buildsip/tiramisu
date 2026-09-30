import { PermissionDeniedError } from "./permission-denied-error";

/** Reduces errors to fixed categories without sending messages, paths, or credentials. */
export function errorCategory(error: unknown): string {
  // A protected memory refused the request; this does not mean the CLI malfunctioned.
  if (error instanceof PermissionDeniedError) return "permission_denied";
  if (!error || typeof error !== "object") return "operation";
  const { code, name, cause } = error as { code?: unknown; name?: unknown; cause?: unknown };
  if (name === "ZodError" || code === -32602) return "invalid_input";
  if (["ENOENT", "EACCES", "EPERM", "ENOTDIR", "EISDIR", "ELOOP"].includes(String(code))) {
    return "filesystem";
  }
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(String(code))) {
    return "connection";
  }
  if (cause && cause !== error && typeof cause === "object") {
    const inner = cause as { name?: unknown };
    if (inner.name === "ZodError") return "invalid_input";
  }
  return "operation";
}
