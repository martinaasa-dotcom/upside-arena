"use client";

import { useEffect } from "react";

/*
  Puts the player's chosen theme where the stylesheet can see it.

  The theme rules are written `[data-arena-theme="house"] .page-frame::before`
  -- a descendant selector, so the attribute has to sit on an ancestor of the
  frame. The layout used to put both on the same div, and a descendant
  combinator never matches the element it starts from, so every theme in the
  shop equipped cleanly and then changed nothing at all. This was found by
  asking a browser to compute the two structures side by side; there is a test
  beside this that keeps asking.

  On the document element, which is the same place the consent banner marks
  itself and is comfortably an ancestor of everything. Doing it from the
  client is what lets the chrome around it be prerendered: the value belongs
  to one player, and a shell that waited for it would not be a shell.

  A theme is an ambient glow behind the page and nothing else -- no colour, no
  layout -- so arriving a frame after the page does is not something anybody
  can catch it doing.
*/
export function ArenaTheme({ theme }: { theme: string | null }) {
  useEffect(() => {
    const root = document.documentElement;

    if (!theme) {
      root.removeAttribute("data-arena-theme");
      return;
    }

    root.setAttribute("data-arena-theme", theme);
    return () => root.removeAttribute("data-arena-theme");
  }, [theme]);

  return null;
}
