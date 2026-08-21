/**
 * Only a same-origin path may be used as a post-sign-in destination.
 * A protocol-relative value such as "//evil.example" is a valid URL to the
 * browser, so rejecting it here is what stops an open redirect.
 */
export function safeNext(next: string | null | undefined, fallback = "/home") {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.startsWith("/\\")) return fallback;
  return next;
}
