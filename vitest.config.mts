import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      /*
        "server-only" throws on import outside a server component, which is a
        build-time guard rather than a runtime one: `next build` is what
        actually enforces it, and it still does. Stubbing it here is what lets
        a server module's logic be tested at all, and the alternative is
        leaving the code that holds the client secret untested.
      */
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
