/** Marks an expected protection refusal; the message tells the agent what to do next. */
export class PermissionDeniedError extends Error {
  override name = "PermissionDeniedError";
}
