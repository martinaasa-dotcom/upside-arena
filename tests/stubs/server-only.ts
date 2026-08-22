/*
  Stands in for the "server-only" package under test.

  The real module throws when imported outside a server component. That check
  belongs to the bundler and `next build` still performs it, so nothing is
  weakened by this: it only makes server modules importable by a test runner
  that has no notion of a component boundary.
*/
export {};
