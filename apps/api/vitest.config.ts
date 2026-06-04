import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Enforce JWT auth in tests so request.user is populated from the Bearer
    // token. auth.ts reads ENFORCE_AUTH once at module load, so it must be set
    // before any source module is imported — a setup file runs early enough.
    setupFiles: ["./test/setup.ts"],
  },
});
