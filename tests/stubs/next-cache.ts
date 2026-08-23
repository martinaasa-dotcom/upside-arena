/*
  Stands in for "next/cache" under test.

  Same reason as the server-only stub next to this one. cacheLife and cacheTag
  refuse to run unless the cacheComponents compiler is what is calling them,
  which a test runner is not, so importing a module that caches anything threw
  before a line of its logic ran -- and the modules that cache things here are
  the price layer and the benchmark, which have sixteen tests between them
  about batching, staleness and sharing a request.

  Nothing is weakened. The directives are compiler instructions and `next
  build` is what checks them; it refuses a cached function that reads
  something it may not, and that check still runs on every pull request. What
  these no-ops restore is the ability to test what the function does, which is
  the part a build cannot check.

  Deliberately not faking a cache. A stub that remembered answers would make
  these tests pass on a cache rather than on the code, and the first thing
  they assert is how often the code goes upstream.
*/
/* eslint-disable @typescript-eslint/no-unused-vars -- the shapes are the point. */
export function cacheLife(profile?: unknown): void {}
export function cacheTag(...tags: string[]): void {}
export function revalidatePath(path: string, type?: unknown): void {}
export function revalidateTag(...tags: string[]): void {}
export function updateTag(...tags: string[]): void {}
