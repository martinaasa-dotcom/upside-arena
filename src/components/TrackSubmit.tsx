"use client";

import type { ComponentProps } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/*
  The smallest client boundary that can say a form was submitted.

  `track` reads consent from the document, so a server component cannot call
  it. Wrapping only the form, and leaving the button as a child, keeps the
  glyph and the label out of the client bundle. The landing renders two of
  these, which is why the rest of the card is not a client island.
*/
export function TrackSubmit({
  event,
  children,
  ...props
}: ComponentProps<"form"> & { event: AnalyticsEvent }) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        props.onSubmit?.(e);
        track(event);
      }}
    >
      {children}
    </form>
  );
}
