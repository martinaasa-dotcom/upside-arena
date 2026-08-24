"use client";

/*
  Telling the server that a screen would not draw.

  Deliberately tiny and deliberately quiet. It is called from an error
  boundary, which is the least reliable moment in the life of a page, so it
  keeps no state, imports nothing, and cannot itself throw: `keepalive` so it
  survives the reader closing the tab, and a swallowed rejection because a
  failed report about a failure is where an infinite loop starts.

  What it sends is the first line of the message, the path without its query
  string, and Next's digest when there is one. Never a stack: a stack is
  different in every browser, so one bug would arrive as a hundred, and it is
  a map of the source besides.
*/

export function reportError(error: Error & { digest?: string }) {
  try {
    const message = (error?.message ?? "").split("\n")[0].slice(0, 300);
    if (!message) return;

    void fetch("/api/error", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        at: window.location.pathname,
        digest: error.digest ?? null,
      }),
    }).catch(() => {
      // A report that cannot be sent is not worth a second failure.
    });
  } catch {
    // Nor is one that cannot be built.
  }
}
