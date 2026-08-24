"use client";

import { useEffect } from "react";

/*
  The last resort: the root layout itself failed.

  This replaces the layout rather than rendering inside it, so none of the
  app's stylesheet, fonts or tokens are available — which is exactly why the
  colours below are written out by hand instead of referenced. They are the
  same values as `--background` and `--foreground` in globals.css. Arena has
  no light theme, and the one screen a person sees when everything else has
  failed should not be the one that flashes white at them.

  Kept to what cannot fail: no imports beyond React, no components, no
  classes. Anything this page depends on is another thing that can be broken
  by the time it is needed.
*/
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("the app failed to render", error);

    /*
      Sent by hand rather than through lib/report-error, because this file
      replaces the root layout and is kept to what cannot fail: no imports
      beyond React, no components, nothing that could itself be the thing
      that is broken.
    */
    try {
      void fetch("/api/error", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: (error?.message ?? "").split("\n")[0].slice(0, 300),
          at: window.location.pathname,
          digest: error.digest ?? null,
        }),
      }).catch(() => {});
    } catch {}
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#000",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main style={{ maxWidth: "28rem", width: "100%" }}>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "1.125rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Upside Arena
          </p>

          <h1 style={{ margin: "0 0 8px", fontSize: "1.125rem", fontWeight: 600 }}>
            Arena would not load
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#b5b5b5",
            }}
          >
            Nothing about your week has changed. Weeks are scored on the server
            from prices we record ourselves, so nothing here depends on this
            page having worked.
          </p>

          <button
            onClick={reset}
            style={{
              appearance: "none",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              background: "#11c0d3",
              color: "#001014",
            }}
          >
            Try again
          </button>

          {error.digest ? (
            <p style={{ margin: "20px 0 0", fontSize: "0.75rem", color: "#8a8a8a" }}>
              If it keeps happening, quoting {error.digest} tells us which
              failure was yours.
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
