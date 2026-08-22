"use client";

import ErrorBoundary from "@/app/error";

/*
  The error screen, rendered where it can be measured.

  A thin client wrapper because the boundary takes a reset callback, and a
  function cannot be handed from a server component to a client one. The
  boundary itself is imported rather than copied, so what the probe measures
  is the screen people actually get.
*/
export function ErrorPreview() {
  return (
    <ErrorBoundary
      error={Object.assign(new Error("sample"), { digest: "3820174659" })}
      reset={() => {}}
    />
  );
}
