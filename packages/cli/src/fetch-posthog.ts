/** Drops failed analytics requests before the SDK can print network errors or retry them. */
export async function fetchPosthog({ url, options }: { url: string; options: RequestInit }) {
  try {
    // Finish before the SDK's own deadline, whose timeout path prints to stderr.
    const timeout = AbortSignal.timeout(500);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await fetch(url, { ...options, signal });
    if (response.ok) return response;

    // Release rejected responses without waiting for a potentially slow error body.
    void response.body?.cancel().catch(() => {});
    throw new Error(`PostHog rejected the analytics request with status ${response.status}.`);
  } catch {
    // TODO: Report this failure to Sentry with source: "posthog-fetch" once Sentry is available.
    // A synthetic success tells the SDK to discard this batch. It does not mean delivery succeeded.
    return new Response('{"status":1}', {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
